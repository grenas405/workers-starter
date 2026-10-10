import type { Config } from "./types.ts";

/**
 * Parse and validate config once, at the edge. Fails loudly on bad values
 * instead of letting a typo surface as a weird bug later.
 */
export function loadConfig(env: Record<string, unknown>): Config {
  const str = (key: string, fallback?: string): string => {
    const v = env[key];
    if (typeof v === "string" && v !== "") return v;
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing config: ${key}`);
  };

  const maxBodyBytes = Number(str("MAX_BODY_BYTES", "1000000"));
  if (!Number.isInteger(maxBodyBytes) || maxBodyBytes <= 0) {
    throw new Error("MAX_BODY_BYTES must be a positive integer");
  }

  const allowedOrigins = str("ALLOWED_ORIGINS", "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const o of allowedOrigins) {
    if (new URL(o).origin !== o) throw new Error(`ALLOWED_ORIGINS entry is not a bare origin: ${o}`);
  }

  return {
    environment: str("ENVIRONMENT", "production"),
    allowedOrigins,
    maxBodyBytes,
  };
}
