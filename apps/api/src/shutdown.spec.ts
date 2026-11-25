import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import { installShutdownHandlers } from "./shutdown.js";

const logger = { log: vi.fn(), error: vi.fn() };

function setup(close: () => Promise<void>, timeoutMs = 1_000) {
  const target = new EventEmitter();
  const exit = vi.fn();
  const app = { close: vi.fn(close) };
  installShutdownHandlers(app, logger, { target, exit, timeoutMs });
  return { target, exit, app };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

describe("installShutdownHandlers", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(["SIGTERM", "SIGINT"] as const)("closes the app and exits 0 on %s", async (signal) => {
    const { target, exit, app } = setup(() => Promise.resolve());
    target.emit(signal);
    await settle();
    expect(app.close).toHaveBeenCalledOnce();
    expect(exit).toHaveBeenCalledWith(0);
  });

  it("ignores a second signal while shutting down", async () => {
    const { target, exit, app } = setup(() => Promise.resolve());
    target.emit("SIGTERM");
    target.emit("SIGINT");
    await settle();
    expect(app.close).toHaveBeenCalledOnce();
    expect(exit).toHaveBeenCalledOnce();
  });

  it("exits 1 when closing fails", async () => {
    const { target, exit } = setup(() => Promise.reject(new Error("pool error")));
    target.emit("SIGTERM");
    await settle();
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("exits 1 when closing takes longer than the timeout", async () => {
    vi.useFakeTimers();
    const { target, exit } = setup(() => new Promise(() => undefined), 500);
    target.emit("SIGTERM");
    vi.advanceTimersByTime(499);
    expect(exit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("does nothing until a signal arrives", () => {
    const { exit, app } = setup(() => Promise.resolve());
    expect(app.close).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });
});
