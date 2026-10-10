// Cloudflare-specific adapter. This file and src/index.ts are the only places
// that know about Workers. Swap them out to move runtimes.
import type { Note, NoteInput, NotesStore } from "../ports/notes-store.ts";

interface Row {
  id: string;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
}

const toNote = (r: Row): Note => ({
  id: r.id,
  title: r.title,
  body: r.body,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export class D1NotesStore implements NotesStore {
  constructor(private readonly db: D1Database) {}

  async list(limit: number): Promise<Note[]> {
    const { results } = await this.db
      .prepare("SELECT * FROM notes ORDER BY created_at DESC LIMIT ?")
      .bind(limit)
      .all<Row>();
    return results.map(toNote);
  }

  async get(id: string): Promise<Note | null> {
    const row = await this.db.prepare("SELECT * FROM notes WHERE id = ?").bind(id).first<Row>();
    return row ? toNote(row) : null;
  }

  async create(input: NoteInput): Promise<Note> {
    const now = new Date().toISOString();
    const row = await this.db
      .prepare(
        "INSERT INTO notes (id, title, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?) RETURNING *",
      )
      .bind(crypto.randomUUID(), input.title, input.body, now, now)
      .first<Row>();
    if (!row) throw new Error("Insert returned no row");
    return toNote(row);
  }

  async update(id: string, input: NoteInput): Promise<Note | null> {
    const row = await this.db
      .prepare("UPDATE notes SET title = ?, body = ?, updated_at = ? WHERE id = ? RETURNING *")
      .bind(input.title, input.body, new Date().toISOString(), id)
      .first<Row>();
    return row ? toNote(row) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.prepare("DELETE FROM notes WHERE id = ?").bind(id).run();
    return result.meta.changes > 0;
  }
}
