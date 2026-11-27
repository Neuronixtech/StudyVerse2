import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from "@nestjs/swagger";
import { FieldErrorSchema, ProblemDetailsSchema } from "../common/errors/problem-details.schema.js";
import type { AppConfig } from "../config/app-config.js";

export const DOCS_PATH = "api/docs";
export const DOCS_JSON_PATH = "api/docs/openapi.json";

/**
 * The OpenAPI 3 contract, generated from the controllers and DTOs (Backend_architecture.md
 * §9.1). A copy is committed as openapi.v1.json and checked by a test, so every contract
 * change shows up in review.
 */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const info = new DocumentBuilder()
    .setTitle("StudyVerse API")
    .setDescription(
      "Versioned REST API under /api/v1. Errors use RFC 9457 Problem Details " +
        "(application/problem+json, schema ProblemDetailsSchema). Every response carries an " +
        "X-Request-Id header.",
    )
    .setVersion("1")
    .build();
  return SwaggerModule.createDocument(app, info, {
    extraModels: [ProblemDetailsSchema, FieldErrorSchema],
  });
}

/** Serves the docs UI and JSON only when enabled: off in production by default (§9.7). */
export function setupOpenApi(app: INestApplication, config: AppConfig): void {
  if (!config.swagger.enabled) return;
  SwaggerModule.setup(DOCS_PATH, app, () => buildOpenApiDocument(app), {
    jsonDocumentUrl: DOCS_JSON_PATH,
    yamlDocumentUrl: undefined,
  });
}
