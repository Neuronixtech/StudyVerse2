import { STATUS_CODES } from "node:http";
import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { PROBLEM_CONTENT_TYPE, type ProblemDetails } from "./problem-details.js";
import { RequestValidationException } from "./validation.js";

type RequestWithId = Request & { id?: unknown };

/** Errors raised by Express's body parser (http-errors), identified by `type`. */
const BODY_PARSER_PROBLEMS: Record<string, { status: number; detail: string; code: string }> = {
  "entity.too.large": {
    status: HttpStatus.PAYLOAD_TOO_LARGE,
    detail: "The request body is too large.",
    code: "payload_too_large",
  },
  "entity.parse.failed": {
    status: HttpStatus.BAD_REQUEST,
    detail: "The request body is not valid JSON.",
    code: "malformed_json",
  },
  "encoding.unsupported": {
    status: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
    detail: "The request body encoding is not supported.",
    code: "unsupported_encoding",
  },
  "charset.unsupported": {
    status: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
    detail: "The request body charset is not supported.",
    code: "unsupported_charset",
  },
  "request.aborted": {
    status: HttpStatus.BAD_REQUEST,
    detail: "The request was aborted.",
    code: "request_aborted",
  },
};

const GENERIC_SERVER_ERROR = "An unexpected error occurred.";

const pathOf = (url: string): string => url.split("?")[0] ?? "";

const titleFor = (status: number): string => STATUS_CODES[status] ?? "Error";

const MALFORMED_URL = {
  status: HttpStatus.BAD_REQUEST,
  detail: "The request URL is malformed.",
  code: "malformed_url",
};

/**
 * Express and its body parser fail before any controller runs. Nest 12 wraps those
 * errors in an HttpException whose `cause` is the original error and whose message is
 * the parser's own text, which can quote parts of the request. They get fixed
 * messages instead. Exceptions thrown by our own code keep their message.
 */
function frameworkProblem(
  exception: unknown,
): { status: number; detail: string; code: string } | undefined {
  const original = exception instanceof HttpException ? exception.cause : exception;
  if (typeof original !== "object" || original === null) return undefined;
  if (original instanceof URIError) return MALFORMED_URL;
  const type = "type" in original ? original.type : undefined;
  return typeof type === "string" ? BODY_PARSER_PROBLEMS[type] : undefined;
}

/** Text an HttpException was created with, if it is safe to show. */
function httpExceptionDetail(exception: HttpException, status: number): string {
  if (status >= 500) return GENERIC_SERVER_ERROR;
  const response = exception.getResponse();
  if (typeof response === "string") return response;
  const message = (response as { message?: unknown }).message;
  if (typeof message === "string") return message;
  if (Array.isArray(message)) return message.filter((m) => typeof m === "string").join("; ");
  return titleFor(status);
}

/**
 * Renders every error as application/problem+json (§9.4). Never returns stack traces,
 * internal error messages, SQL or query strings. Unexpected errors become a generic
 * 500 and are logged with the request ID so they can be found.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger("ProblemDetailsFilter");

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<RequestWithId>();
    const response = http.getResponse<Response>();
    const requestId = typeof request.id === "string" ? request.id : undefined;
    const problem = this.toProblem(exception, pathOf(request.originalUrl ?? request.url));
    if (requestId !== undefined) problem.requestId = requestId;

    if (problem.status >= 500) {
      this.logger.error(
        { err: exception, requestId, path: problem.instance },
        "Request failed with an unexpected error",
      );
    }

    response.status(problem.status).type(PROBLEM_CONTENT_TYPE).json(problem);
  }

  private toProblem(exception: unknown, instance: string): ProblemDetails {
    const base = { type: "about:blank", instance };

    if (exception instanceof RequestValidationException) {
      return {
        ...base,
        title: titleFor(HttpStatus.BAD_REQUEST),
        status: HttpStatus.BAD_REQUEST,
        detail: "The request is invalid.",
        code: "validation_failed",
        errors: exception.fieldErrors,
      };
    }

    const framework = frameworkProblem(exception);
    if (framework !== undefined) {
      const { status, detail, code } = framework;
      return { ...base, title: titleFor(status), status, detail, code };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return {
        ...base,
        title: titleFor(status),
        status,
        detail: httpExceptionDetail(exception, status),
      };
    }

    const status = HttpStatus.INTERNAL_SERVER_ERROR;
    return { ...base, title: titleFor(status), status, detail: GENERIC_SERVER_ERROR };
  }
}
