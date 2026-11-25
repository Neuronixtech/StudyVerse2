import { Inject, Injectable, type OnModuleDestroy } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import type { AppConfig } from "../config/app-config.js";
import { APP_CONFIG } from "../config/app-config.module.js";
import { PrismaClient } from "../generated/prisma/client.js";

/**
 * The process's single PrismaClient (Backend_architecture.md §13.2), connected through
 * the PostgreSQL driver adapter (§7.2) as the least-privilege app role in DATABASE_URL.
 *
 * The pg pool is bounded (DATABASE_POOL_MAX) and opens connections lazily: the API
 * starts even while the database is down, and the readiness check reports it.
 * Business modules use Prisma inside their own persistence layer (§4).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    super({
      adapter: new PrismaPg({
        connectionString: config.database.url,
        max: config.database.poolMax,
        connectionTimeoutMillis: config.database.connectTimeoutMs,
      }),
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
