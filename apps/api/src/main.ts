import "reflect-metadata";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module.js";
import { APP_CREATE_OPTIONS, configureApp } from "./app.setup.js";
import { ConfigValidationError, loadConfig, type AppConfig } from "./config/app-config.js";

/**
 * Reads apps/api/.env when present (local development). Deployments set real
 * environment variables, which always take precedence over the file.
 */
function loadLocalEnvFile(): void {
  const envFile = fileURLToPath(new URL("../.env", import.meta.url));
  if (existsSync(envFile)) process.loadEnvFile(envFile);
}

function readConfig(): AppConfig {
  try {
    return loadConfig(process.env);
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      // The message names the invalid variables; it never contains their values.
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }
}

async function bootstrap(): Promise<void> {
  loadLocalEnvFile();
  const config = readConfig();
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(config), {
    ...APP_CREATE_OPTIONS,
    // Hold startup logs until the structured logger is ready.
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  configureApp(app, config);
  // Close the HTTP server and database pool cleanly on SIGTERM/SIGINT (container stop).
  app.enableShutdownHooks();
  await app.listen(config.http.port, config.http.host);
}

await bootstrap();
