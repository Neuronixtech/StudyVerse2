import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test, type TestingModuleBuilder } from "@nestjs/testing";
import type { ModuleMetadata } from "@nestjs/common";
import { APP_CREATE_OPTIONS, configureApp } from "../app.setup.js";
import { loadConfig, type AppConfig } from "../config/app-config.js";

/** A valid test config; override any environment variable per test. */
export function testConfig(env: NodeJS.ProcessEnv = {}): AppConfig {
  return loadConfig({
    NODE_ENV: "test",
    LOG_LEVEL: "silent",
    // Nothing listens on port 1: tests that need a real database use their own URL.
    DATABASE_URL: "postgresql://studyverse_app:unused@127.0.0.1:1/studyverse_test",
    ...env,
  });
}

/**
 * Builds and starts an app the way main.ts does (same create options, same
 * configureApp), from the given module metadata.
 */
export async function createTestApp(
  metadata: ModuleMetadata,
  config: AppConfig,
  customize: (builder: TestingModuleBuilder) => TestingModuleBuilder = (b) => b,
): Promise<NestExpressApplication> {
  const moduleRef = await customize(Test.createTestingModule(metadata)).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>(APP_CREATE_OPTIONS);
  configureApp(app, config);
  await app.init();
  return app;
}
