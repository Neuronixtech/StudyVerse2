import { VersioningType, type INestApplication } from "@nestjs/common";
import { ProblemDetailsFilter } from "./common/errors/problem-details.filter.js";
import { createValidationPipe } from "./common/errors/validation.js";

/**
 * HTTP conventions shared by the server (main.ts) and the tests, so tests exercise
 * exactly what production runs.
 */
export function configureApp(app: INestApplication): void {
  // Every route lives under /api/v1 (Backend_architecture.md §9.1). Caddy forwards
  // /api/* to this process; page routes go to Next.js.
  app.setGlobalPrefix("api");
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new ProblemDetailsFilter());
}
