import { Controller, Get, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, it } from "vitest";
import { configureApp } from "./app.setup.js";

@Controller("probe")
class ProbeController {
  @Get()
  get() {
    return { ok: true };
  }
}

describe("configureApp", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [ProbeController] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("serves routes under /api/v1", async () => {
    await request(app.getHttpServer()).get("/api/v1/probe").expect(200, { ok: true });
  });

  it("does not serve routes outside the /api/v1 prefix", async () => {
    await request(app.getHttpServer()).get("/probe").expect(404);
    await request(app.getHttpServer()).get("/api/probe").expect(404);
  });
});
