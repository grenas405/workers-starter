import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.ts";

describe("loadConfig", () => {
  it("applies defaults", () => {
    expect(loadConfig({})).toEqual({ environment: "production", allowedOrigins: [], maxBodyBytes: 1_000_000 });
  });

  it("parses origins and limits", () => {
    const c = loadConfig({ ALLOWED_ORIGINS: "https://a.com, https://b.com", MAX_BODY_BYTES: "500" });
    expect(c.allowedOrigins).toEqual(["https://a.com", "https://b.com"]);
    expect(c.maxBodyBytes).toBe(500);
  });

  it("fails loudly on bad values", () => {
    expect(() => loadConfig({ MAX_BODY_BYTES: "lots" })).toThrow();
    expect(() => loadConfig({ ALLOWED_ORIGINS: "https://a.com/path" })).toThrow();
  });
});
