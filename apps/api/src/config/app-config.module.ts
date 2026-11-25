import { Global, Module, type DynamicModule } from "@nestjs/common";
import type { AppConfig } from "./app-config.js";

/** Injection token for the validated AppConfig: `@Inject(APP_CONFIG) config: AppConfig`. */
export const APP_CONFIG = Symbol("APP_CONFIG");

/**
 * Makes the validated configuration injectable everywhere. The config is built once in
 * main.ts (or by a test) and passed in, so modules never read process.env directly.
 */
@Global()
@Module({})
export class AppConfigModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: AppConfigModule,
      providers: [{ provide: APP_CONFIG, useValue: config }],
      exports: [APP_CONFIG],
    };
  }
}
