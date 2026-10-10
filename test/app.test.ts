// Tests call the app function directly — no server, no Workers runtime needed.
import { describe, expect, it, vi } from "vitest";
import { MemoryNotesStore } from "../src/adapters/memory-notes-store.ts";
import { createApp } from "../src/app.ts";
import type { NotesStore } from "../src/ports/notes-store.ts";
import type { Deps } from "../src/types.ts";

const silentLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

function setup(overrides: Partial<Deps> = {}) {
  const deps: Deps = {
    notes: new MemoryNotesStore(),
    config: { environment: "test", allowedOrigins: ["https://trusted.example"], maxBodyBytes: 1000 },
    log: silentLog,
    ...overrides,
  };
  return createApp(deps);
}

const BASE = "https://app.example";
// Workers types make res.json() return unknown; tests read loosely-typed JSON.
const body = (res: Response): Promise<any> => res.json();
const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(BASE + path, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

describe("basics", () => {
  it("serves /health", async () => {
    const res = await setup()(new Request(`${BASE}/health`));
    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ ok: true, environment: "test" });
  });

  it("adds request id and security headers", async () => {
    const res = await setup()(new Request(`${BASE}/health`));
    expect(res.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("reuses a well-formed incoming request id", async () => {
    const res = await setup()(new Request(`${BASE}/health`, { headers: { "x-request-id": "abc12345" } }));
    expect(res.headers.get("x-request-id")).toBe("abc12345");
  });

  it("returns JSON 404 for unknown routes", async () => {
    const res = await setup()(new Request(`${BASE}/nope`));
    expect(res.status).toBe(404);
    expect((await body(res)).error).toBe("Not found");
  });

  it("returns 405 with Allow header for wrong method", async () => {
    const res = await setup()(new Request(`${BASE}/health`, { method: "DELETE" }));
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("GET, HEAD");
  });
});

describe("notes CRUD", () => {
  it("creates, reads, lists, updates and deletes", async () => {
    const app = setup();

    const created = await app(post("/api/notes", { title: "  Hello ", body: "World" }));
    expect(created.status).toBe(201);
    const note = await body(created);
    expect(note.title).toBe("Hello");
    expect(created.headers.get("location")).toBe(`/api/notes/${note.id}`);

    const got = await app(new Request(`${BASE}/api/notes/${note.id}`));
    expect((await body(got)).body).toBe("World");

    const list = await app(new Request(`${BASE}/api/notes`));
    expect((await body(list)).notes).toHaveLength(1);

    const updated = await app(
      new Request(`${BASE}/api/notes/${note.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Changed", body: "" }),
      }),
    );
    expect((await body(updated)).title).toBe("Changed");

    const del = await app(new Request(`${BASE}/api/notes/${note.id}`, { method: "DELETE" }));
    expect(del.status).toBe(204);
    const gone = await app(new Request(`${BASE}/api/notes/${note.id}`));
    expect(gone.status).toBe(404);
  });

  it("rejects invalid input with details", async () => {
    const res = await setup()(post("/api/notes", { title: "" }));
    expect(res.status).toBe(400);
    expect((await body(res)).details).toContain("title is required");
  });

  it("rejects malformed JSON", async () => {
    const res = await setup()(post("/api/notes", "{not json"));
    expect(res.status).toBe(400);
  });

  it("rejects the wrong content type", async () => {
    const res = await setup()(post("/api/notes", "x", { "content-type": "text/plain" }));
    expect(res.status).toBe(415);
  });

  it("rejects bodies over the limit", async () => {
    const res = await setup()(post("/api/notes", { title: "x", body: "y".repeat(2000) }));
    expect(res.status).toBe(413);
  });
});

describe("CSRF protection", () => {
  it("blocks cross-origin writes", async () => {
    const res = await setup()(post("/api/notes", { title: "x" }, { origin: "https://evil.example" }));
    expect(res.status).toBe(403);
  });

  it("allows same-origin and allow-listed origins", async () => {
    const app = setup();
    expect((await app(post("/api/notes", { title: "x" }, { origin: BASE }))).status).toBe(201);
    expect((await app(post("/api/notes", { title: "x" }, { origin: "https://trusted.example" }))).status).toBe(201);
  });
});

describe("error handling", () => {
  it("hides internal errors and logs them", async () => {
    class BrokenStore extends MemoryNotesStore {
      override list(): never {
        throw new Error("db exploded: secret details");
      }
    }
    const broken: NotesStore = new BrokenStore();
    const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const res = await setup({ notes: broken, log })(new Request(`${BASE}/api/notes`));
    expect(res.status).toBe(500);
    const data = await body(res);
    expect(data.error).toBe("Internal server error");
    expect(JSON.stringify(data)).not.toContain("secret");
    expect(log.error).toHaveBeenCalledOnce();
  });
});
