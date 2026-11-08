/**
 * Only same-origin relative paths are accepted as post-login destinations,
 * which prevents open redirects such as ?next=//evil.example or /\evil.example.
 */
export function safeNext(next: unknown, fallback = "/dashboard"): string {
  if (typeof next !== "string" || next.length === 0 || next.length > 512) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f\\]/.test(next)) return fallback;
  return next;
}
