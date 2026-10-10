import { HttpError, json, withHeaders } from "./http.ts";
import type { Middleware } from "./types.ts";

/** Echo the request ID back so users can quote it in bug reports. */
export const requestId: Middleware = (next) => async (req, ctx) =>
  withHeaders(await next(req, ctx), { "x-request-id": ctx.requestId });

/** One structured log line per request. */
export const logging: Middleware = (next) => async (req, ctx) => {
  const start = Date.now();
  const res = await next(req, ctx);
  ctx.deps.log.info({
    msg: "request",
    id: ctx.requestId,
    method: req.method,
    path: new URL(req.url).pathname,
    status: res.status,
    ms: Date.now() - start,
  });
  return res;
};

/** Turns thrown errors into consistent JSON. Never leaks stack traces. */
export const errors: Middleware = (next) => async (req, ctx) => {
  try {
    return await next(req, ctx);
  } catch (err) {
    if (err instanceof HttpError) {
      const headers: Record<string, string> = {};
      const allow = (err.details as { allow?: string[] } | undefined)?.allow;
      if (err.status === 405 && allow) headers["allow"] = allow.join(", ");
      return json(
        { error: err.message, details: err.status === 405 ? undefined : err.details, requestId: ctx.requestId },
        { status: err.status, headers },
      );
    }
    ctx.deps.log.error({
      msg: "unhandled error",
      id: ctx.requestId,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return json({ error: "Internal server error", requestId: ctx.requestId }, { status: 500 });
  }
};

/** Baseline security headers for API responses. Static assets get theirs from public/_headers. */
export const securityHeaders: Middleware = (next) => async (req, ctx) =>
  withHeaders(await next(req, ctx), {
    "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "strict-transport-security": "max-age=63072000; includeSubDomains",
    "cross-origin-resource-policy": "same-origin",
  });

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF protection: browsers send Origin on state-changing requests.
 * Reject cross-site ones unless explicitly allowed. Non-browser clients
 * (curl, server-to-server) send no Origin and pass through — protect those with auth.
 */
export const sameOrigin: Middleware = (next) => async (req, ctx) => {
  if (!SAFE_METHODS.has(req.method)) {
    const origin = req.headers.get("origin");
    const self = new URL(req.url).origin;
    const fetchSite = req.headers.get("sec-fetch-site");
    if (origin) {
      if (origin !== self && !ctx.deps.config.allowedOrigins.includes(origin)) {
        throw new HttpError(403, "Cross-origin request rejected");
      }
    } else if (fetchSite === "cross-site") {
      throw new HttpError(403, "Cross-origin request rejected");
    }
  }
  return next(req, ctx);
};
