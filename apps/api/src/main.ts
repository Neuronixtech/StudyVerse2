import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module.js";
import { configureApp } from "./app.setup.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);
  // Close the HTTP server and database pool cleanly on SIGTERM/SIGINT (container stop).
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 3001), process.env.HOST ?? "127.0.0.1");
}

await bootstrap();
