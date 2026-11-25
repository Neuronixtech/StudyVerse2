import { BadRequestException, ValidationPipe, type ValidationError } from "@nestjs/common";
import type { FieldError } from "./problem-details.js";

/** Thrown by the global ValidationPipe; rendered as 400 with field errors. */
export class RequestValidationException extends BadRequestException {
  constructor(readonly fieldErrors: FieldError[]) {
    super("The request is invalid.");
  }
}

/** Flattens class-validator's nested errors into dotted field paths. */
export function toFieldErrors(errors: ValidationError[], parent = ""): FieldError[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own: FieldError[] = error.constraints
      ? [{ field, messages: Object.values(error.constraints) }]
      : [];
    return [...own, ...toFieldErrors(error.children ?? [], field)];
  });
}

/**
 * Request validation for every DTO (§9.3): unknown fields are rejected, accepted
 * fields are transformed to their declared types, and failures become field errors.
 */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    validationError: { target: false, value: false },
    exceptionFactory: (errors) => new RequestValidationException(toFieldErrors(errors)),
  });
}
