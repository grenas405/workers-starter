import type { Note, NoteInput, NotesStore } from "../ports/notes-store.ts";

/** In-memory adapter for tests and quick experiments. Runs on any runtime. */
export class MemoryNotesStore implements NotesStore {
  #notes = new Map<string, Note>();

  async list(limit: number): Promise<Note[]> {
    return [...this.#notes.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  async get(id: string): Promise<Note | null> {
    return this.#notes.get(id) ?? null;
  }

  async create(input: NoteInput): Promise<Note> {
    const now = new Date().toISOString();
    const note: Note = { id: crypto.randomUUID(), ...input, createdAt: now, updatedAt: now };
    this.#notes.set(note.id, note);
    return note;
  }

  async update(id: string, input: NoteInput): Promise<Note | null> {
    const existing = this.#notes.get(id);
    if (!existing) return null;
    const note = { ...existing, ...input, updatedAt: new Date().toISOString() };
    this.#notes.set(id, note);
    return note;
  }

  async delete(id: string): Promise<boolean> {
    return this.#notes.delete(id);
  }
}
