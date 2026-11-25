import { Inject, Injectable, Logger } from "@nestjs/common";
import { HealthIndicatorService, type HealthIndicatorResult } from "@nestjs/terminus";
import type { AppConfig } from "../config/app-config.js";
import { APP_CONFIG } from "../config/app-config.module.js";
import { PrismaService } from "../database/prisma.service.js";

class TimeoutError extends Error {
  constructor(ms: number) {
    super(`no answer within ${ms} ms`);
  }
}

async function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(ms)), ms);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Readiness of the database: `SELECT 1` must answer within HEALTH_DB_TIMEOUT_MS.
 * The result only says up or down; the driver's error (which can name hosts, ports
 * or roles) is logged, never returned.
 */
@Injectable()
export class DatabaseHealthIndicator {
  private readonly logger = new Logger("DatabaseHealthIndicator");

  constructor(
    private readonly prisma: PrismaService,
    private readonly indicators: HealthIndicatorService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async isHealthy(key = "database"): Promise<HealthIndicatorResult> {
    const indicator = this.indicators.check(key);
    try {
      await withTimeout(this.prisma.$queryRaw`SELECT 1`, this.config.health.databaseTimeoutMs);
      return indicator.up();
    } catch (error) {
      this.logger.warn({ err: error }, "Database readiness check failed");
      return indicator.down();
    }
  }
}
