import type { Logger } from "./types.ts";

/** JSON lines to console. Workers Logs indexes these fields automatically. */
export const consoleLogger: Logger = {
  info: (f) => console.log(JSON.stringify({ level: "info", ...f })),
  warn: (f) => console.warn(JSON.stringify({ level: "warn", ...f })),
  error: (f) => console.error(JSON.stringify({ level: "error", ...f })),
};
