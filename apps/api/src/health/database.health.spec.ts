import { Logger } from "@nestjs/common";
import { HealthIndicatorService } from "@nestjs/terminus";
import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { APP_CONFIG } from "../config/app-config.module.js";
import { PrismaService } from "../database/prisma.service.js";
import { testConfig } from "../testing/create-test-app.js";
import { DatabaseHealthIndicator } from "./database.health.js";

async function indicatorWith(queryRaw: () => Promise<unknown>, timeoutMs = 100) {
  const moduleRef = await Test.createTestingModule({
    providers: [
      DatabaseHealthIndicator,
      HealthIndicatorService,
      { provide: PrismaService, useValue: { $queryRaw: vi.fn(queryRaw) } },
      { provide: APP_CONFIG, useValue: testConfig({ HEALTH_DB_TIMEOUT_MS: String(timeoutMs) }) },
    ],
  }).compile();
  return moduleRef.get(DatabaseHealthIndicator);
}

describe("DatabaseHealthIndicator", () => {
  it("is up when SELECT 1 answers", async () => {
    const result = await (
      await indicatorWith(() => Promise.resolve([{ "?column?": 1 }]))
    ).isHealthy();
    expect(result).toEqual({ database: { status: "up" } });
  });

  it("is down, without the driver's error, when the query fails", async () => {
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    const indicator = await indicatorWith(() =>
      Promise.reject(
        new Error("password authentication failed for user studyverse_app at db.internal"),
      ),
    );
    const result = await indicator.isHealthy();
    expect(result).toEqual({ database: { status: "down" } });
    expect(JSON.stringify(result)).not.toContain("db.internal");
    expect(warn).toHaveBeenCalledOnce();
  });

  it("is down when the database doesn't answer within the timeout", async () => {
    vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    const indicator = await indicatorWith(() => new Promise(() => undefined), 100);
    const started = Date.now();
    const result = await indicator.isHealthy();
    expect(result).toEqual({ database: { status: "down" } });
    expect(Date.now() - started).toBeLessThan(1_000);
  });
});
