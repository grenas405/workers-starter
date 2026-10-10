// The "port": what the app needs from storage. Adapters implement it.
export interface Note {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface NoteInput {
  title: string;
  body: string;
}

export interface NotesStore {
  list(limit: number): Promise<Note[]>;
  get(id: string): Promise<Note | null>;
  create(input: NoteInput): Promise<Note>;
  update(id: string, input: NoteInput): Promise<Note | null>;
  delete(id: string): Promise<boolean>;
}
