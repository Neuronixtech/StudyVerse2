import { describe, expect, it } from "vitest";
import { resolveRequestId } from "./request-id.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("resolveRequestId", () => {
  it.each(["3f1c2a9e-8f0b-4f7e-9b6a-2d1c4e5f6a7b", "00-4bf92f3577b34da6-01", "req_123.abc:9"])(
    "reuses a safe incoming id %j",
    (id) => {
      expect(resolveRequestId(id)).toBe(id);
    },
  );

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["a newline (log injection)", "abc\nlevel=error fake"],
    ["spaces", "abc def"],
    ["too long", "a".repeat(129)],
    ["quotes", 'abc"}'],
  ])("generates a UUID when the incoming id is %s", (_case, id) => {
    expect(resolveRequestId(id)).toMatch(UUID);
  });

  it("uses the first value when the header is repeated", () => {
    expect(resolveRequestId(["first-id", "second-id"])).toBe("first-id");
  });

  it("generates a different id each time", () => {
    expect(resolveRequestId(undefined)).not.toBe(resolveRequestId(undefined));
  });
});
