// Core types. Nothing in here depends on Cloudflare — only web standards.
import type { NotesStore } from "./ports/notes-store.ts";

export interface Logger {
  info(fields: Record<string, unknown>): void;
  warn(fields: Record<string, unknown>): void;
  error(fields: Record<string, unknown>): void;
}

export interface Config {
  environment: string;
  /** Extra origins allowed to make state-changing requests (CSRF check). */
  allowedOrigins: string[];
  maxBodyBytes: number;
}

/** Everything the app needs from the outside world, injected at the edge. */
export interface Deps {
  notes: NotesStore;
  config: Config;
  log: Logger;
}

export interface Ctx {
  requestId: string;
  params: Record<string, string>;
  deps: Deps;
  /** Run work after the response is sent (maps to ctx.waitUntil on Workers). */
  waitUntil(promise: Promise<unknown>): void;
}

export type Handler = (req: Request, ctx: Ctx) => Promise<Response>;
export type Middleware = (next: Handler) => Handler;
