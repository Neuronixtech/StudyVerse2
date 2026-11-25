import type { IncomingMessage, ServerResponse } from "node:http";
import { Module, type DynamicModule } from "@nestjs/common";
import { LoggerModule } from "nestjs-pino";
import { stdTimeFunctions, type DestinationStream } from "pino";
import type { AppConfig } from "../../config/app-config.js";
import { APP_CONFIG } from "../../config/app-config.module.js";
import { REQUEST_ID_HEADER, resolveRequestId } from "./request-id.js";

/**
 * Defence in depth: the serializers below never log headers or bodies, but if anything
 * ever adds them, these values are still masked (Backend_architecture.md §15.1).
 */
export const REDACTED_PATHS = [
  "req.headers.cookie",
  "req.headers.authorization",
  'req.headers["x-csrf-token"]',
  'res.headers["set-cookie"]',
  "*.password",
  "*.token",
];

const HEALTH_PATH = /^\/api\/v1\/health(\/|$)/;

/** Path without the query string: queries can carry tokens and personal data. */
const pathOf = (url: string | undefined): string => (url ?? "").split("?")[0] ?? "";

export interface LoggingOptions {
  /** Where log lines go. Defaults to stdout; tests pass a capturing stream. */
  destination?: DestinationStream;
}

/**
 * Structured JSON logs (pino) with a request ID on every line and every response
 * (§9.7, §15.1). One line per request: method, path, status, duration and request ID.
 * Never headers, cookies, bodies or query strings.
 */
@Module({})
export class LoggingModule {
  static forRoot(options: LoggingOptions = {}): DynamicModule {
    return {
      module: LoggingModule,
      imports: [
        LoggerModule.forRootAsync({
          inject: [APP_CONFIG],
          useFactory: (config: AppConfig) => {
            const pinoHttpOptions = {
              level: config.log.level,
              base: { service: "studyverse-api", env: config.nodeEnv },
              timestamp: stdTimeFunctions.isoTime,
              formatters: { level: (label: string) => ({ level: label }) },
              redact: { paths: REDACTED_PATHS, censor: "[redacted]" },
              genReqId: (req: IncomingMessage, res: ServerResponse) => {
                const id = resolveRequestId(req.headers[REQUEST_ID_HEADER]);
                res.setHeader("X-Request-Id", id);
                return id;
              },
              serializers: {
                req: (req: { id: unknown; method: string; url: string }) => ({
                  id: req.id,
                  method: req.method,
                  path: pathOf(req.url),
                }),
                res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
              },
              customLogLevel: (_req: IncomingMessage, res: ServerResponse, error?: Error) =>
                error !== undefined || res.statusCode >= 500
                  ? "error"
                  : res.statusCode >= 400
                    ? "warn"
                    : "info",
              // Orchestrator health probes run every few seconds; don't log each one.
              autoLogging: { ignore: (req: IncomingMessage) => HEALTH_PATH.test(pathOf(req.url)) },
            };
            return {
              pinoHttp:
                options.destination === undefined
                  ? pinoHttpOptions
                  : [pinoHttpOptions, options.destination],
            };
          },
        }),
      ],
    };
  }
}
