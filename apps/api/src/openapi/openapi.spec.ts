import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { AppModule } from "../app.module.js";
import { createTestApp, testConfig } from "../testing/create-test-app.js";
import { buildOpenApiDocument } from "./openapi.js";

const SNAPSHOT = fileURLToPath(new URL("../../openapi.v1.json", import.meta.url));

describe("OpenAPI contract", () => {
  let app: NestExpressApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  const start = async (env: NodeJS.ProcessEnv = {}) => {
    const config = testConfig(env);
    app = await createTestApp({ imports: [AppModule.forRoot(config)] }, config);
    return app;
  };

  it("matches the committed openapi.v1.json", async () => {
    const json = `${JSON.stringify(buildOpenApiDocument(await start()), null, 2)}\n`;
    if (process.env.UPDATE_OPENAPI === "1") {
      writeFileSync(SNAPSHOT, json);
      return;
    }
    expect(existsSync(SNAPSHOT), "openapi.v1.json is missing: run npm run openapi:update").toBe(
      true,
    );
    expect(
      json,
      "The API contract changed. Review the change, run `npm run openapi:update` and commit openapi.v1.json.",
    ).toBe(readFileSync(SNAPSHOT, "utf8"));
  });

  it("documents the health endpoints and the Problem Details error schema", async () => {
    const doc = buildOpenApiDocument(await start());
    expect(Object.keys(doc.paths).toSorted()).toEqual([
      "/api/v1/health/live",
      "/api/v1/health/ready",
    ]);
    expect(doc.paths["/api/v1/health/ready"]?.get?.responses).toHaveProperty("503");
    expect(doc.components?.schemas).toHaveProperty("ProblemDetailsSchema");
  });

  it("serves the docs UI and JSON when enabled", async () => {
    const http = request((await start({ SWAGGER_ENABLED: "true" })).getHttpServer());
    const ui = await http.get("/api/docs").expect(200);
    expect(ui.headers["content-type"]).toMatch(/text\/html/);
    const json = await http.get("/api/docs/openapi.json").expect(200);
    expect(json.body).toMatchObject({
      openapi: expect.stringMatching(/^3\./),
      info: { title: "StudyVerse API" },
    });
  });

  it("serves no docs when disabled (the production default)", async () => {
    const http = request((await start({ NODE_ENV: "production" })).getHttpServer());
    await http.get("/api/docs").expect(404);
    await http.get("/api/docs/openapi.json").expect(404);
  });
});
