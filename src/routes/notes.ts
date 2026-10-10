import { HttpError, json, readJson } from "../http.ts";
import type { NoteInput } from "../ports/notes-store.ts";
import type { Router } from "../router.ts";

/** Small hand-rolled validator. Swap in Zod/Valibot if your schemas grow. */
function parseNoteInput(data: unknown): NoteInput {
  if (typeof data !== "object" || data === null) {
    throw new HttpError(400, "Body must be a JSON object");
  }
  const { title, body = "" } = data as Record<string, unknown>;
  const issues: string[] = [];
  if (typeof title !== "string" || title.trim() === "") issues.push("title is required");
  else if (title.length > 200) issues.push("title must be 200 characters or fewer");
  if (typeof body !== "string") issues.push("body must be a string");
  else if (body.length > 10_000) issues.push("body must be 10,000 characters or fewer");
  if (issues.length) throw new HttpError(400, "Validation failed", issues);
  return { title: (title as string).trim(), body: body as string };
}

export function notesRoutes(r: Router): Router {
  return r
    .get("/api/notes", async (req, ctx) => {
      const raw = Number(new URL(req.url).searchParams.get("limit") ?? 50);
      const limit = Number.isInteger(raw) ? Math.min(Math.max(raw, 1), 100) : 50;
      return json({ notes: await ctx.deps.notes.list(limit) });
    })
    .get("/api/notes/:id", async (_req, ctx) => {
      const note = await ctx.deps.notes.get(ctx.params.id!);
      if (!note) throw new HttpError(404, "Note not found");
      return json(note);
    })
    .post("/api/notes", async (req, ctx) => {
      const input = parseNoteInput(await readJson(req, ctx.deps.config.maxBodyBytes));
      const note = await ctx.deps.notes.create(input);
      return json(note, { status: 201, headers: { location: `/api/notes/${note.id}` } });
    })
    .put("/api/notes/:id", async (req, ctx) => {
      const input = parseNoteInput(await readJson(req, ctx.deps.config.maxBodyBytes));
      const note = await ctx.deps.notes.update(ctx.params.id!, input);
      if (!note) throw new HttpError(404, "Note not found");
      return json(note);
    })
    .delete("/api/notes/:id", async (_req, ctx) => {
      const deleted = await ctx.deps.notes.delete(ctx.params.id!);
      if (!deleted) throw new HttpError(404, "Note not found");
      return new Response(null, { status: 204 });
    });
}
