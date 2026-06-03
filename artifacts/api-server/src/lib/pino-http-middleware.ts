import { createRequire } from "node:module";
import type { HttpLogger, Options as PinoHttpOptions } from "pino-http";

const require = createRequire(import.meta.url);

/** pino-http ships as CJS; load via require so tsc/Vercel do not mis-resolve default exports. */
type PinoHttpFactory = (opts?: PinoHttpOptions) => HttpLogger;

const pinoHttpFactory = require("pino-http") as PinoHttpFactory;

export function createPinoHttpMiddleware(opts?: PinoHttpOptions): HttpLogger {
  return pinoHttpFactory(opts);
}

export type { PinoHttpOptions };
