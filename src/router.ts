import { HttpError } from "./http.ts";
import type { Handler } from "./types.ts";

interface Route {
  method: string;
  segments: string[];
  handler: Handler;
}

/** Tiny dependency-free router. Paths like "/api/notes/:id". */
export class Router {
  #routes: Route[] = [];

  on(method: string, path: string, handler: Handler): this {
    this.#routes.push({ method: method.toUpperCase(), segments: split(path), handler });
    return this;
  }
  get(path: string, h: Handler) { return this.on("GET", path, h); }
  post(path: string, h: Handler) { return this.on("POST", path, h); }
  put(path: string, h: Handler) { return this.on("PUT", path, h); }
  patch(path: string, h: Handler) { return this.on("PATCH", path, h); }
  delete(path: string, h: Handler) { return this.on("DELETE", path, h); }

  handle: Handler = async (req, ctx) => {
    const parts = split(new URL(req.url).pathname);
    const method = req.method === "HEAD" ? "GET" : req.method;
    const allowed = new Set<string>();

    for (const route of this.#routes) {
      const params = match(route.segments, parts);
      if (!params) continue;
      allowed.add(route.method);
      if (route.method === method) {
        return route.handler(req, { ...ctx, params });
      }
    }

    if (allowed.size > 0) {
      if (allowed.has("GET")) allowed.add("HEAD");
      throw new HttpError(405, "Method not allowed", { allow: [...allowed] });
    }
    throw new HttpError(404, "Not found");
  };
}

function split(path: string): string[] {
  return path.split("/").filter(Boolean);
}

function match(pattern: string[], parts: string[]): Record<string, string> | null {
  if (pattern.length !== parts.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < pattern.length; i++) {
    const p = pattern[i]!;
    const v = parts[i]!;
    if (p.startsWith(":")) {
      try {
        params[p.slice(1)] = decodeURIComponent(v);
      } catch {
        throw new HttpError(400, "Malformed URL");
      }
    } else if (p !== v) {
      return null;
    }
  }
  return params;
}
