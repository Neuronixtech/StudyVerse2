import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Request } from "express";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { createTestApp, testConfig } from "./testing/create-test-app.js";

@Controller("probe")
class ProbeController {
  @Get()
  get() {
    return { ok: true };
  }

  @Get("ip")
  ip(@Req() req: Request) {
    return { ip: req.ip, protocol: req.protocol };
  }

  @Post("echo")
  echo(@Body() body: unknown) {
    return { received: body ?? null };
  }
}

describe("configureApp", () => {
  let app: NestExpressApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  const start = async (env: NodeJS.ProcessEnv = {}) => {
    app = await createTestApp({ controllers: [ProbeController] }, testConfig(env));
    return request(app.getHttpServer());
  };

  describe("routing", () => {
    it("serves routes under /api/v1 only", async () => {
      const http = await start();
      await http.get("/api/v1/probe").expect(200, { ok: true });
      await http.get("/probe").expect(404);
      await http.get("/api/probe").expect(404);
    });
  });

  describe("security headers", () => {
    it("sets helmet's headers and hides X-Powered-By", async () => {
      const res = await (await start()).get("/api/v1/probe").expect(200);
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
      expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
      expect(res.headers["strict-transport-security"]).toMatch(/max-age=\d+/);
      expect(res.headers["content-security-policy"]).toContain("default-src 'self'");
      expect(res.headers["referrer-policy"]).toBe("no-referrer");
      expect(res.headers["x-powered-by"]).toBeUndefined();
    });

    it("sets them on error responses too", async () => {
      const res = await (await start()).get("/api/v1/missing").expect(404);
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
    });
  });

  describe("CORS", () => {
    it("allows no cross-origin access by default (same-origin)", async () => {
      const res = await (
        await start()
      )
        .get("/api/v1/probe")
        .set("Origin", "https://evil.example")
        .expect(200);
      expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    });

    it("allows exactly the configured origins, with credentials", async () => {
      const http = await start({ CORS_ORIGINS: "https://studyverse.example" });
      const allowed = await http.get("/api/v1/probe").set("Origin", "https://studyverse.example");
      expect(allowed.headers["access-control-allow-origin"]).toBe("https://studyverse.example");
      expect(allowed.headers["access-control-allow-credentials"]).toBe("true");
      expect(allowed.headers["access-control-expose-headers"]).toContain("X-Request-Id");

      const other = await http.get("/api/v1/probe").set("Origin", "https://evil.example");
      expect(other.headers["access-control-allow-origin"]).toBeUndefined();

      const preflight = await http
        .options("/api/v1/probe/echo")
        .set("Origin", "https://studyverse.example")
        .set("Access-Control-Request-Method", "POST")
        .expect(204);
      expect(preflight.headers["access-control-allow-origin"]).toBe("https://studyverse.example");
    });
  });

  describe("trust proxy", () => {
    it("ignores X-Forwarded-* by default", async () => {
      const res = await (
        await start()
      )
        .get("/api/v1/probe/ip")
        .set("X-Forwarded-For", "203.0.113.9")
        .set("X-Forwarded-Proto", "https")
        .expect(200);
      const { ip, protocol }: { ip: string; protocol: string } = res.body;
      expect(protocol).toBe("http");
      expect(ip).not.toBe("203.0.113.9");
    });

    it("uses the forwarded client address and protocol behind one trusted proxy", async () => {
      const res = await (
        await start({ TRUST_PROXY: "1" })
      )
        .get("/api/v1/probe/ip")
        .set("X-Forwarded-For", "203.0.113.9")
        .set("X-Forwarded-Proto", "https")
        .expect(200);
      expect(res.body).toEqual({ ip: "203.0.113.9", protocol: "https" });
    });
  });

  describe("request bodies", () => {
    it("parses JSON bodies", async () => {
      await (
        await start()
      )
        .post("/api/v1/probe/echo")
        .send({ a: 1 })
        .expect(201, { received: { a: 1 } });
    });

    it("does not parse form-encoded bodies (JSON-only API)", async () => {
      const res = await (
        await start()
      )
        .post("/api/v1/probe/echo")
        .type("form")
        .send("a=1")
        .expect(201);
      expect(res.body).not.toEqual({ received: { a: "1" } });
    });
  });
});
