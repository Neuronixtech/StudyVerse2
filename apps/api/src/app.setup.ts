import { VersioningType, type INestApplication } from "@nestjs/common";

/**
 * HTTP conventions shared by the server (main.ts) and the tests, so tests exercise
 * exactly what production runs.
 */
export function configureApp(app: INestApplication): void {
  // Every route lives under /api/v1 (Backend_architecture.md §9.1). Caddy forwards
  // /api/* to this process; page routes go to Next.js.
  app.setGlobalPrefix("api");
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
}
