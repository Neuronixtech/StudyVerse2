import { Controller, Get, Res, ServiceUnavailableException } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { HealthCheck, HealthCheckService, type HealthCheckResult } from "@nestjs/terminus";
import type { Response } from "express";
import { DatabaseHealthIndicator } from "./database.health.js";

const isHealthCheckResult = (value: unknown): value is HealthCheckResult =>
  typeof value === "object" && value !== null && "status" in value && "details" in value;

/**
 * Probes for Docker/Caddy health checks and monitoring. Both answer in Terminus's
 * standard shape ({ status, info, error, details }) with 200 or 503. @HealthCheck()
 * marks them uncacheable; they aren't written to the request log.
 */
@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: DatabaseHealthIndicator,
  ) {}

  /** Liveness: the process is up and serving HTTP. Never touches the database. */
  @Get("live")
  @HealthCheck()
  live(): Promise<HealthCheckResult> {
    return this.health.check([]);
  }

  /** Readiness: the API can serve requests, which needs the database. 503 if not. */
  @Get("ready")
  @HealthCheck()
  async ready(@Res({ passthrough: true }) res: Response): Promise<HealthCheckResult> {
    try {
      return await this.health.check([() => this.database.isHealthy()]);
    } catch (error) {
      // Terminus signals "not ready" with a 503 exception carrying the health result.
      // Return that result as-is rather than as a generic error.
      const result = error instanceof ServiceUnavailableException ? error.getResponse() : undefined;
      if (isHealthCheckResult(result)) {
        res.status(503);
        return result;
      }
      throw error;
    }
  }
}
