import {
  Body,
  ConflictException,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  ServiceUnavailableException,
  type INestApplication,
} from "@nestjs/common";
import { Type } from "class-transformer";
import { IsEmail, IsInt, IsString, Min, ValidateNested } from "class-validator";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AppConfigModule } from "../../config/app-config.module.js";
import { createTestApp, testConfig } from "../../testing/create-test-app.js";
import { LoggingModule } from "../logging/logging.module.js";
import type { ProblemDetails } from "./problem-details.js";

const fieldsOf = ({ errors = [] }: ProblemDetails): string[] => errors.map((e) => e.field);

class AddressDto {
  @IsString()
  postalCode!: string;
}

class SignupDto {
  @IsEmail()
  email!: string;

  @IsInt()
  @Min(1)
  seats!: number;

  @ValidateNested()
  @Type(() => AddressDto)
  address!: AddressDto;
}

@Controller("errors")
class ErrorsController {
  @Get("conflict")
  conflict() {
    throw new ConflictException("A pending request already exists.");
  }

  @Get("crash")
  crash() {
    throw new Error("connect ECONNREFUSED db.internal:5432 password=hunter2");
  }

  @Get("unavailable")
  unavailable() {
    throw new ServiceUnavailableException("pool exhausted at db.internal");
  }

  @Get("items/:id")
  item(@Param("id") id: string) {
    return { id };
  }

  @Post("signup")
  signup(@Body() body: SignupDto) {
    return { ok: true, seatsType: typeof body.seats };
  }
}

describe("ProblemDetailsFilter", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const config = testConfig();
    app = await createTestApp(
      {
        imports: [AppConfigModule.forRoot(config), LoggingModule.forRoot()],
        controllers: [ErrorsController],
      },
      config,
    );
  });

  afterAll(async () => {
    await app.close();
  });

  let errorLog: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    errorLog = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
  });

  const http = () => request(app.getHttpServer());

  it("renders an unknown route as a 404 problem, without the query string", async () => {
    const res = await http()
      .get("/api/v1/nowhere?token=abc")
      .set("X-Request-Id", "req-404")
      .expect(404);
    expect(res.headers["content-type"]).toMatch(/^application\/problem\+json/);
    expect(res.body).toEqual({
      type: "about:blank",
      title: "Not Found",
      status: 404,
      detail: expect.any(String),
      instance: "/api/v1/nowhere",
      requestId: "req-404",
    });
  });

  it("keeps the message of a deliberate 4xx", async () => {
    const res = await http().get("/api/v1/errors/conflict").expect(409);
    expect(res.body).toMatchObject({
      type: "about:blank",
      title: "Conflict",
      status: 409,
      detail: "A pending request already exists.",
      instance: "/api/v1/errors/conflict",
    });
  });

  it("hides internal details of unexpected errors behind a generic 500", async () => {
    const res = await http().get("/api/v1/errors/crash").expect(500);
    expect(res.body).toMatchObject({
      title: "Internal Server Error",
      status: 500,
      detail: "An unexpected error occurred.",
    });
    const text = JSON.stringify(res.body);
    for (const secret of ["hunter2", "db.internal", "ECONNREFUSED", "stack", "at "]) {
      expect(text).not.toContain(secret);
    }
  });

  it("logs unexpected errors server-side with the request ID", async () => {
    await http().get("/api/v1/errors/crash").set("X-Request-Id", "req-500").expect(500);
    expect(errorLog).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: "req-500", path: "/api/v1/errors/crash" }),
      "Request failed with an unexpected error",
    );
  });

  it("doesn't log expected client errors as server errors", async () => {
    await http().get("/api/v1/errors/conflict").expect(409);
    expect(errorLog).not.toHaveBeenCalled();
  });

  it("renders a malformed URL encoding as a 400 problem", async () => {
    const res = await http().get("/api/v1/errors/items/%FF").expect(400);
    expect(res.body).toMatchObject({
      code: "malformed_url",
      detail: "The request URL is malformed.",
    });
  });

  it("hides the message of a deliberate 5xx too", async () => {
    const res = await http().get("/api/v1/errors/unavailable").expect(503);
    expect(res.body).toMatchObject({
      title: "Service Unavailable",
      detail: "An unexpected error occurred.",
    });
    expect(JSON.stringify(res.body)).not.toContain("db.internal");
  });

  it("lists field errors for an invalid body, including nested fields", async () => {
    const res = await http()
      .post("/api/v1/errors/signup")
      .send({ email: "not-an-email", seats: 0, address: { postalCode: 411001 } })
      .expect(400);
    expect(res.body).toMatchObject({
      status: 400,
      code: "validation_failed",
      detail: "The request is invalid.",
    });
    const fields = fieldsOf(res.body).toSorted();
    expect(fields).toEqual(["address.postalCode", "email", "seats"]);
    expect(JSON.stringify(res.body)).not.toContain("not-an-email");
  });

  it("rejects unknown fields", async () => {
    const res = await http()
      .post("/api/v1/errors/signup")
      .send({ email: "a@b.in", seats: 1, address: { postalCode: "411001" }, role: "OWNER" })
      .expect(400);
    expect(fieldsOf(res.body)).toEqual(["role"]);
  });

  it("transforms a valid body to the declared types", async () => {
    await http()
      .post("/api/v1/errors/signup")
      .send({ email: "a@b.in", seats: 2, address: { postalCode: "411001" } })
      .expect(201, { ok: true, seatsType: "number" });
  });

  it("renders malformed JSON as a 400 problem without echoing the body", async () => {
    const res = await http()
      .post("/api/v1/errors/signup")
      .set("Content-Type", "application/json")
      .send('{"email": "a@b.in", SECRET-FRAGMENT')
      .expect(400);
    expect(res.headers["content-type"]).toMatch(/^application\/problem\+json/);
    expect(res.body).toMatchObject({
      code: "malformed_json",
      detail: "The request body is not valid JSON.",
    });
    expect(JSON.stringify(res.body)).not.toContain("SECRET-FRAGMENT");
  });

  it("renders an oversized body as a 413 problem", async () => {
    const res = await http()
      .post("/api/v1/errors/signup")
      .send({ email: "a@b.in", padding: "x".repeat(200 * 1024) })
      .expect(413);
    expect(res.body).toMatchObject({ status: 413, code: "payload_too_large" });
  });
});
