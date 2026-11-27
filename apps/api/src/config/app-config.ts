// class-transformer's decorators use reflect-metadata, and this module runs before
// Nest (which would otherwise load the polyfill) starts.
import "reflect-metadata";
import { plainToInstance, Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  Validate,
  ValidatorConstraint,
  validateSync,
  type ValidationArguments,
  type ValidatorConstraintInterface,
} from "class-validator";

export const NODE_ENVS = ["development", "test", "production"] as const;
export type NodeEnv = (typeof NODE_ENVS)[number];

export const LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

/** Validated, typed settings for the API process. Built once at startup. */
export interface AppConfig {
  nodeEnv: NodeEnv;
  http: {
    host: string;
    port: number;
    /** Largest accepted JSON body (Backend_architecture.md §9.7). */
    jsonBodyLimit: string;
    /** Exact origins allowed for cross-origin browser requests; empty = same-origin only. */
    corsOrigins: string[];
    /** Express "trust proxy": false, true, or the number of proxy hops (Caddy = 1). */
    trustProxy: boolean | number;
  };
  log: { level: LogLevel };
  database: { url: string; poolMax: number; connectTimeoutMs: number };
  health: { databaseTimeoutMs: number };
  swagger: { enabled: boolean };
}

/** Fixed rather than configurable: no endpoint needs large JSON bodies (§9.7). */
export const JSON_BODY_LIMIT = "100kb";

@ValidatorConstraint({ name: "isPostgresUrl" })
class IsPostgresUrl implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== "string") return false;
    try {
      const url = new URL(value);
      return (
        (url.protocol === "postgresql:" || url.protocol === "postgres:") && url.hostname !== ""
      );
    } catch {
      return false;
    }
  }
  defaultMessage(args: ValidationArguments): string {
    // Never echo the value: connection strings contain passwords.
    return `${args.property} must be a postgresql:// connection URL`;
  }
}

const ORIGIN = /^https?:\/\/[a-z0-9.-]+(:\d{1,5})?$/i;

@ValidatorConstraint({ name: "isOriginList" })
class IsOriginList implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === "string" && splitList(value).every((origin) => ORIGIN.test(origin));
  }
  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a comma-separated list of exact origins such as https://studyverse.example (no paths or wildcards)`;
  }
}

const parseBoolean = (value: unknown): unknown =>
  value === "true" ? true : value === "false" ? false : value;

const splitList = (value: string): string[] =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

/** The environment variables the API reads, with their rules and defaults. */
class EnvironmentVariables {
  @IsIn(NODE_ENVS)
  NODE_ENV!: NodeEnv;

  @IsString()
  @MinLength(1)
  HOST = "127.0.0.1";

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3001;

  @IsIn(LOG_LEVELS)
  LOG_LEVEL: LogLevel = "info";

  @Validate(IsPostgresUrl)
  DATABASE_URL!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  DATABASE_POOL_MAX: number = 10;

  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(60_000)
  DATABASE_CONNECT_TIMEOUT_MS: number = 5_000;

  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(30_000)
  HEALTH_DB_TIMEOUT_MS: number = 2_000;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => parseBoolean(value))
  @IsBoolean({ message: "SWAGGER_ENABLED must be true or false" })
  SWAGGER_ENABLED?: boolean;

  @Validate(IsOriginList)
  CORS_ORIGINS = "";

  @Matches(/^(true|false|[0-9]{1,2})$/, {
    message: "TRUST_PROXY must be true, false or a number of proxy hops",
  })
  TRUST_PROXY = "false";
}

const KNOWN_KEYS = Object.keys(new EnvironmentVariables()).concat([
  "NODE_ENV",
  "DATABASE_URL",
  "SWAGGER_ENABLED",
]);

export class ConfigValidationError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid environment configuration:\n  - ${problems.join("\n  - ")}`);
    this.name = "ConfigValidationError";
  }
}

/**
 * Validates the environment and returns typed settings. Throws ConfigValidationError
 * naming every invalid variable. Values are never included in the error: they can be
 * secrets.
 */
export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const known = Object.fromEntries(
    [...new Set(KNOWN_KEYS)].filter((key) => env[key] !== undefined).map((key) => [key, env[key]]),
  );
  const vars = plainToInstance(EnvironmentVariables, known);
  const errors = validateSync(vars, { forbidUnknownValues: true });
  if (errors.length > 0) {
    throw new ConfigValidationError(
      errors.flatMap((error) => Object.values(error.constraints ?? {})).toSorted(),
    );
  }

  const trustProxy =
    vars.TRUST_PROXY === "true"
      ? true
      : vars.TRUST_PROXY === "false"
        ? false
        : Number(vars.TRUST_PROXY);

  return {
    nodeEnv: vars.NODE_ENV,
    http: {
      host: vars.HOST,
      port: vars.PORT,
      jsonBodyLimit: JSON_BODY_LIMIT,
      corsOrigins: splitList(vars.CORS_ORIGINS),
      trustProxy,
    },
    log: { level: vars.LOG_LEVEL },
    database: {
      url: vars.DATABASE_URL,
      poolMax: vars.DATABASE_POOL_MAX,
      connectTimeoutMs: vars.DATABASE_CONNECT_TIMEOUT_MS,
    },
    health: { databaseTimeoutMs: vars.HEALTH_DB_TIMEOUT_MS },
    // API docs are on by default except in production (§9.7).
    swagger: { enabled: vars.SWAGGER_ENABLED ?? vars.NODE_ENV !== "production" },
  };
}
