import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

/** OpenAPI schema for one field error (mirrors FieldError). */
export class FieldErrorSchema {
  @ApiProperty({ example: "address.postalCode" })
  field!: string;

  @ApiProperty({ type: [String], example: ["postalCode must be a string"] })
  messages!: string[];
}

/**
 * OpenAPI schema for the API's error format, RFC 9457 Problem Details (mirrors
 * ProblemDetails). Served as application/problem+json.
 */
export class ProblemDetailsSchema {
  @ApiProperty({ example: "about:blank" })
  type!: string;

  @ApiProperty({ example: "Bad Request" })
  title!: string;

  @ApiProperty({ example: 400 })
  status!: number;

  @ApiProperty({ example: "The request is invalid." })
  detail!: string;

  @ApiProperty({ description: "Request path, without the query string.", example: "/api/v1/..." })
  instance!: string;

  @ApiPropertyOptional({
    description: "Stable code for cases clients act on.",
    example: "validation_failed",
  })
  code?: string;

  @ApiPropertyOptional({ description: "Same value as the X-Request-Id response header." })
  requestId?: string;

  @ApiPropertyOptional({ type: [FieldErrorSchema] })
  errors?: FieldErrorSchema[];
}
