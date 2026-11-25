/** RFC 9457 Problem Details, the API's single error format (Backend_architecture.md §9.4). */
export interface ProblemDetails {
  /** A URI identifying the problem type; "about:blank" means "see title and status". */
  type: string;
  title: string;
  status: number;
  detail: string;
  /** The request path, without the query string. */
  instance: string;
  /** Stable, machine-readable code for cases clients act on. */
  code?: string;
  requestId?: string;
  /** Field-level problems for invalid requests. */
  errors?: FieldError[];
}

export interface FieldError {
  /** Dotted path to the field, for example "address.postalCode". */
  field: string;
  messages: string[];
}

export const PROBLEM_CONTENT_TYPE = "application/problem+json";
