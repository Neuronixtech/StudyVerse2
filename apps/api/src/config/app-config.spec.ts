import { describe, expect, it } from "vitest";
import { ConfigValidationError, loadConfig } from "./app-config.js";

const DB = "postgresql://studyverse_app:s3cr3t-pa55@127.0.0.1:5432/studyverse";
const base = { NODE_ENV: "development", DATABASE_URL: DB };

function problems(env: NodeJS.ProcessEnv): string[] {
  try {
    loadConfig(env);
  } catch (error) {
    if (error instanceof ConfigValidationError) return error.problems;
    throw error;
  }
  throw new Error("expected loadConfig to throw");
}

describe("loadConfig", () => {
  it("applies defaults for everything optional", () => {
    expect(loadConfig(base)).toEqual({
      nodeEnv: "development",
      http: {
        host: "127.0.0.1",
        port: 3001,
        jsonBodyLimit: "100kb",
        corsOrigins: [],
        trustProxy: false,
      },
      log: { level: "info" },
      database: { url: DB, poolMax: 10, connectTimeoutMs: 5000 },
      health: { databaseTimeoutMs: 2000 },
      swagger: { enabled: true },
    });
  });

  it("converts numbers, booleans and lists from strings", () => {
    const config = loadConfig({
      ...base,
      HOST: "0.0.0.0",
      PORT: "8080",
      DATABASE_POOL_MAX: "20",
      SWAGGER_ENABLED: "false",
      CORS_ORIGINS: "https://studyverse.example, http://localhost:3000",
      TRUST_PROXY: "1",
      LOG_LEVEL: "debug",
    });
    expect(config.http).toMatchObject({
      host: "0.0.0.0",
      port: 8080,
      corsOrigins: ["https://studyverse.example", "http://localhost:3000"],
      trustProxy: 1,
    });
    expect(config.database.poolMax).toBe(20);
    expect(config.swagger.enabled).toBe(false);
    expect(config.log.level).toBe("debug");
    expect(loadConfig({ ...base, TRUST_PROXY: "true" }).http.trustProxy).toBe(true);
  });

  it("turns API docs off by default in production, unless explicitly enabled", () => {
    expect(loadConfig({ ...base, NODE_ENV: "production" }).swagger.enabled).toBe(false);
    expect(
      loadConfig({ ...base, NODE_ENV: "production", SWAGGER_ENABLED: "true" }).swagger.enabled,
    ).toBe(true);
  });

  it("reports every missing required variable at once", () => {
    const found = problems({});
    expect(found.some((p) => p.startsWith("NODE_ENV"))).toBe(true);
    expect(found.some((p) => p.startsWith("DATABASE_URL"))).toBe(true);
  });

  it.each([
    ["PORT", "70000"],
    ["PORT", "abc"],
    ["PORT", ""],
    ["DATABASE_POOL_MAX", "0"],
    ["HEALTH_DB_TIMEOUT_MS", "10"],
    ["LOG_LEVEL", "verbose"],
    ["SWAGGER_ENABLED", "yes"],
    ["TRUST_PROXY", "maybe"],
    ["CORS_ORIGINS", "*"],
    ["CORS_ORIGINS", "https://studyverse.example/path"],
    ["DATABASE_URL", "mysql://u:p@localhost/db"],
    ["NODE_ENV", "staging"],
  ])("rejects %s=%j", (key, value) => {
    expect(problems({ ...base, [key]: value }).some((p) => p.startsWith(key))).toBe(true);
  });

  it("never includes values in errors, since they can be secrets", () => {
    const leaky = problems({
      ...base,
      DATABASE_URL: "http://admin:t0p-s3cret@db.internal/x",
      PORT: "-1",
    });
    const message = leaky.join("\n");
    expect(message).toContain("DATABASE_URL");
    expect(message).not.toContain("t0p-s3cret");
    expect(message).not.toContain("db.internal");

    const otherError = problems({ ...base, PORT: "-1" }).join("\n");
    expect(otherError).not.toContain("s3cr3t-pa55");
  });

  it("ignores unrelated environment variables", () => {
    expect(() => loadConfig({ ...base, PATH: "/usr/bin", SOMETHING_ELSE: "x" })).not.toThrow();
  });
});
