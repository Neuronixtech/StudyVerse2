import { VersioningType } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import helmet from "helmet";
import { ProblemDetailsFilter } from "./common/errors/problem-details.filter.js";
import { createValidationPipe } from "./common/errors/validation.js";
import type { AppConfig } from "./config/app-config.js";

/**
 * Options the app must be created with, in main.ts and in tests alike. The default
 * body parser is off so configureApp registers exactly one, with an explicit limit.
 */
export const APP_CREATE_OPTIONS = { bodyParser: false } as const;

/**
 * HTTP conventions shared by the server (main.ts) and the tests, so tests exercise
 * exactly what production runs.
 */
export function configureApp(app: NestExpressApplication, config: AppConfig): void {
  // Behind Caddy, trust exactly the configured hops so req.ip and the protocol are
  // the client's, not the proxy's. Off by default (§12.3).
  app.set("trust proxy", config.http.trustProxy);

  // Security headers (§9.7, §14.1): HSTS, nosniff, frame denial, a strict CSP, no
  // X-Powered-By.
  app.use(helmet());

  // JSON only, with a small body limit (§9.7). Larger or other bodies are refused.
  app.useBodyParser("json", { limit: config.http.jsonBodyLimit });

  // Same-origin by default (§9.7, §12.3). Cross-origin access is only for exact,
  // configured origins.
  if (config.http.corsOrigins.length > 0) {
    app.enableCors({
      origin: config.http.corsOrigins,
      credentials: true,
      exposedHeaders: ["X-Request-Id"],
    });
  }

  // Every route lives under /api/v1 (§9.1). Caddy forwards /api/* to this process;
  // page routes go to Next.js.
  app.setGlobalPrefix("api");
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new ProblemDetailsFilter());
}
