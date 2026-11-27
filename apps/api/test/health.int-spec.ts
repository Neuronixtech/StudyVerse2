import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/database/prisma.service.js";
import { createTestApp, testConfig } from "../src/testing/create-test-app.js";
import { TEST_DATABASE_URL } from "./setup/integration-env.js";

describe("health endpoints against PostgreSQL", () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const config = testConfig({ DATABASE_URL: TEST_DATABASE_URL });
    app = await createTestApp({ imports: [AppModule.forRoot(config)] }, config);
  });

  afterAll(async () => {
    await app.close();
  });

  it("ready: 200 with the database up", async () => {
    const res = await request(app.getHttpServer()).get("/api/v1/health/ready").expect(200);
    expect(res.body).toEqual({
      status: "ok",
      info: { database: { status: "up" } },
      error: {},
      details: { database: { status: "up" } },
    });
  });

  it("connects as the least-privilege app role, on PostgreSQL 18", async () => {
    const prisma = app.get(PrismaService);
    const [row] = await prisma.$queryRaw<{ role: string; version: number }[]>`
      SELECT current_user AS role, current_setting('server_version_num')::int AS version`;
    expect(row?.role).toBe("studyverse_app");
    expect(row?.version).toBeGreaterThanOrEqual(180000);
    expect(row?.version).toBeLessThan(190000);
  });
});
