import type { INestApplication, LoggerService } from "@nestjs/common";

export interface ShutdownOptions {
  /** How long app.close() may take before the process exits anyway. */
  timeoutMs?: number;
  exit?: (code: number) => void;
  signals?: readonly NodeJS.Signals[];
  /** Where signal handlers are registered; tests pass an EventEmitter. */
  target?: Pick<NodeJS.Process, "once">;
}

/**
 * Graceful shutdown on SIGTERM/SIGINT (container stop, Ctrl-C): stop accepting
 * connections, let in-flight requests finish, close the database pool (app.close()
 * runs every module's shutdown hooks), then exit 0. Exits 1 if closing fails or takes
 * longer than timeoutMs.
 *
 * Explicit, rather than Nest's enableShutdownHooks(): that re-raises the signal after
 * closing, and a process running as PID 1 in a container ignores a re-raised SIGTERM,
 * so `docker stop` would wait and then kill it.
 */
export function installShutdownHandlers(
  app: Pick<INestApplication, "close">,
  logger: Pick<LoggerService, "log" | "error">,
  {
    timeoutMs = 10_000,
    exit = (code) => process.exit(code),
    signals = ["SIGTERM", "SIGINT"],
    target = process,
  }: ShutdownOptions = {},
): void {
  let shuttingDown = false;

  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.log(`Received ${signal}; shutting down`, "Shutdown");

    const deadline = setTimeout(() => {
      logger.error(`Shutdown took longer than ${timeoutMs} ms; exiting`, undefined, "Shutdown");
      exit(1);
    }, timeoutMs);
    deadline.unref();

    app.close().then(
      () => {
        clearTimeout(deadline);
        logger.log("Shutdown complete", "Shutdown");
        exit(0);
      },
      (error: unknown) => {
        clearTimeout(deadline);
        logger.error(`Shutdown failed: ${String(error)}`, undefined, "Shutdown");
        exit(1);
      },
    );
  };

  for (const signal of signals) target.once(signal, () => shutdown(signal));
}
