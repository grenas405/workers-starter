// The whole app as one web-standard function: (Request) => Promise<Response>.
// No Cloudflare APIs in here — it runs on Workers, Deno, Bun, or Node.
import { compose, json } from "./http.ts";
import { errors, logging, requestId, sameOrigin, securityHeaders } from "./middleware.ts";
import { Router } from "./router.ts";
import { notesRoutes } from "./routes/notes.ts";
import type { Ctx, Deps } from "./types.ts";

export interface Platform {
  waitUntil?(promise: Promise<unknown>): void;
}

const ID_PATTERN = /^[A-Za-z0-9._-]{8,128}$/;

export function createApp(deps: Deps) {
  const router = new Router()
    .get("/health", async (_req, ctx) =>
      json({ ok: true, environment: ctx.deps.config.environment }, { headers: { "cache-control": "no-store" } }),
    );
  notesRoutes(router);

  // Order matters: outermost first.
  const handler = compose(requestId, logging, securityHeaders, errors, sameOrigin)(router.handle);

  return (req: Request, platform: Platform = {}): Promise<Response> => {
    const incoming = req.headers.get("x-request-id");
    const ctx: Ctx = {
      requestId: incoming && ID_PATTERN.test(incoming) ? incoming : crypto.randomUUID(),
      params: {},
      deps,
      waitUntil: (p) => (platform.waitUntil ? platform.waitUntil(p) : void p.catch(() => {})),
    };
    return handler(req, ctx);
  };
}
