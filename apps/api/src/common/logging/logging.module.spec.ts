import { Writable } from "node:stream";
import { Controller, Get, type INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppConfigModule } from "../../config/app-config.module.js";
import { createTestApp, testConfig } from "../../testing/create-test-app.js";
import { LoggingModule } from "./logging.module.js";

@Controller("probe")
class ProbeController {
  @Get()
  get() {
    return { ok: true };
  }
}

@Controller("health")
class FakeHealthController {
  @Get("live")
  live() {
    return { status: "ok" };
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

describe("LoggingModule", () => {
  let app: INestApplication;
  let lines: Record<string, unknown>[] = [];
  const destination = new Writable({
    write(chunk: Buffer, _encoding, done) {
      for (const line of chunk.toString().split("\n").filter(Boolean)) {
        const parsed: unknown = JSON.parse(line);
        if (isRecord(parsed)) lines.push(parsed);
      }
      done();
    },
  });

  beforeAll(async () => {
    const config = testConfig({ LOG_LEVEL: "info" });
    app = await createTestApp(
      {
        imports: [AppConfigModule.forRoot(config), LoggingModule.forRoot({ destination })],
        controllers: [ProbeController, FakeHealthController],
      },
      config,
    );
  });

  beforeEach(() => {
    lines = [];
  });

  afterAll(async () => {
    await app.close();
  });

  const requestLines = () => lines.filter((line) => line.req !== undefined);

  it("echoes a safe incoming X-Request-Id and logs one JSON line with it", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/probe?reset_token=SHOULD-NOT-BE-LOGGED")
      .set("X-Request-Id", "trace-abc-123")
      .expect(200);
    expect(res.headers["x-request-id"]).toBe("trace-abc-123");

    const [line] = requestLines();
    expect(line).toMatchObject({
      level: "info",
      service: "studyverse-api",
      env: "test",
      req: { id: "trace-abc-123", method: "GET", path: "/api/v1/probe" },
      res: { statusCode: 200 },
    });
    expect(typeof line?.time).toBe("string");
    expect(typeof line?.responseTime).toBe("number");
  });

  it("replaces an unsafe incoming request id with a UUID", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/probe")
      .set("X-Request-Id", "bad id with spaces")
      .expect(200);
    expect(res.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("never logs cookies, authorization headers or query strings", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/probe?email=learner@example.com")
      .set("Cookie", "__Host-sid=SESSION-SECRET")
      .set("Authorization", "Bearer TOKEN-SECRET")
      .expect(200);
    const output = JSON.stringify(lines);
    expect(output).not.toContain("SESSION-SECRET");
    expect(output).not.toContain("TOKEN-SECRET");
    expect(output).not.toContain("learner@example.com");
  });

  it("logs client errors at warn level", async () => {
    await request(app.getHttpServer()).get("/api/v1/missing").expect(404);
    expect(requestLines()[0]).toMatchObject({ level: "warn", res: { statusCode: 404 } });
  });

  it("doesn't log health probes", async () => {
    await request(app.getHttpServer()).get("/api/v1/health/live").expect(200);
    expect(requestLines()).toHaveLength(0);
  });
});
