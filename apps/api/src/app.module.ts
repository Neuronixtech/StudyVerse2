import { Module, type DynamicModule } from "@nestjs/common";
import type { AppConfig } from "./config/app-config.js";
import { AppConfigModule } from "./config/app-config.module.js";
import { LoggingModule } from "./common/logging/logging.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { HealthModule } from "./health/health.module.js";

@Module({})
export class AppModule {
  /** The root module is built from an already-validated config (main.ts or a test). */
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [
        AppConfigModule.forRoot(config),
        LoggingModule.forRoot(),
        DatabaseModule,
        HealthModule,
      ],
    };
  }
}
