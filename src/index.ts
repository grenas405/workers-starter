// Cloudflare Workers entry point. The only file that wires Workers to the app.
import { D1NotesStore } from "./adapters/d1-notes-store.ts";
import { createApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { consoleLogger } from "./log.ts";

// Build the app once per isolate and reuse it across requests.
let app: ReturnType<typeof createApp> | undefined;

export default {
  async fetch(req, env, ctx): Promise<Response> {
    app ??= createApp({
      notes: new D1NotesStore(env.DB),
      config: loadConfig(env as unknown as Record<string, unknown>),
      log: consoleLogger,
    });
    return app(req, { waitUntil: (p) => ctx.waitUntil(p) });
  },
} satisfies ExportedHandler<Env>;
