import { z } from "zod";

// Opaque keyset cursor: base64url(JSON{c: created_at, i: id}).
// Keyset (not OFFSET) pagination stays fast on large tables and doesn't skip
// or repeat rows when new tasks are inserted between page loads.
const cursorSchema = z.object({ c: z.iso.datetime({ offset: true }), i: z.uuid() });
export type Cursor = z.infer<typeof cursorSchema>;

export function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c)).toString("base64url");
}

/** Returns null for anything malformed or tampered with, never throws. */
export function decodeCursor(raw: string | undefined | null): Cursor | null {
  if (!raw) return null;
  try {
    const parsed = cursorSchema.safeParse(JSON.parse(Buffer.from(raw, "base64url").toString("utf8")));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Escapes LIKE wildcards and strips PostgREST filter syntax from free-text search. */
export function toSearchPattern(q: string): string {
  const cleaned = q.replace(/[\\%_]/g, (ch) => `\\${ch}`).replace(/[(),"]/g, " ").trim();
  return `%${cleaned}%`;
}
