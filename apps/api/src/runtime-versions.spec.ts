import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Local development (.nvmrc), CI (setup-node reads .nvmrc), the container image
// (Dockerfile) and package.json engines must agree on the Node version, and the
// PostgreSQL image must match between Compose and CI.
const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

const nvmrc = read("../.nvmrc").trim();
const [major, minor, patch] = nvmrc.split(".").map(Number);

describe("runtime versions", () => {
  it(".nvmrc pins an exact Node 22 release", () => {
    expect(nvmrc).toMatch(/^22\.\d+\.\d+$/);
  });

  it("satisfies package.json engines (>=22.22.3 <23)", () => {
    const pkg: { engines: { node: string } } = JSON.parse(read("../package.json"));
    expect(pkg.engines.node).toBe(">=22.22.3 <23");
    expect(major).toBe(22);
    expect(minor > 22 || (minor === 22 && patch >= 3)).toBe(true);
  });

  it("the Dockerfile builds on the same Node version", () => {
    expect(read("../Dockerfile")).toContain(`ARG NODE_VERSION=${nvmrc}\n`);
  });

  it("CI uses .nvmrc and the same PostgreSQL image as Compose", () => {
    const workflow = read("../../../.github/workflows/backend-tests.yml");
    const compose = read("../../../infra/compose.yaml");
    expect(workflow).toContain("node-version-file: apps/api/.nvmrc");
    const image = /image: (postgres:[\w.-]+)/.exec(compose)?.[1];
    expect(image).toBe("postgres:18.7-trixie");
    expect(workflow).toContain(`image: ${image}`);
  });
});
