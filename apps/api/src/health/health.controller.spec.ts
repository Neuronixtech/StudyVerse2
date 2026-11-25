import { Logger } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AppModule } from "../app.module.js";
import { createTestApp, testConfig } from "../testing/create-test-app.js";

// The full AppModule with an unreachable database (nothing listens on 127.0.0.1:1).
// The readiness check against a real PostgreSQL is in test/health.int-spec.ts.
describe("health endpoints (database unreachable)", () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const config = testConfig({ HEALTH_DB_TIMEOUT_MS: "1000" });
    app = await createTestApp({ imports: [AppModule.forRoot(config)] }, config);
  });

  beforeEach(() => {
    vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
  });

  afterAll(async () => {
    await app.close();
  });

  it("live: 200 without touching the database, never cached", async () => {
    const res = await request(app.getHttpServer()).get("/api/v1/health/live").expect(200);
    expect(res.body).toEqual({ status: "ok", info: {}, error: {}, details: {} });
    expect(res.headers["cache-control"]).toContain("no-store");
  });

  it("ready: 503 with the database marked down, and no driver details", async () => {
    const started = Date.now();
    const res = await request(app.getHttpServer()).get("/api/v1/health/ready").expect(503);
    expect(Date.now() - started).toBeLessThan(3_000);
    expect(res.headers["content-type"]).toMatch(/^application\/json/);
    expect(res.headers["cache-control"]).toContain("no-store");
    expect(res.body).toEqual({
      status: "error",
      info: {},
      error: { database: { status: "down" } },
      details: { database: { status: "down" } },
    });
    const text = JSON.stringify(res.body);
    for (const leak of ["ECONNREFUSED", "127.0.0.1", "studyverse_app", "unused"]) {
      expect(text).not.toContain(leak);
    }
  });
});
