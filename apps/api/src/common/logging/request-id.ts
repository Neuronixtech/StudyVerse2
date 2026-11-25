import { randomUUID } from "node:crypto";

export const REQUEST_ID_HEADER = "x-request-id";

/** UUIDs, trace IDs and similar tokens: short, no whitespace or control characters. */
const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;

/**
 * Returns the caller's X-Request-Id when it is a short, safe token (so a proxy or the
 * frontend can correlate requests), otherwise a new UUID. Rejecting anything else keeps
 * attacker-controlled text such as newlines out of the logs.
 */
export function resolveRequestId(incoming: string | string[] | undefined): string {
  const value = Array.isArray(incoming) ? incoming[0] : incoming;
  return value !== undefined && SAFE_REQUEST_ID.test(value) ? value : randomUUID();
}
