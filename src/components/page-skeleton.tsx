export function PageSkeleton() {
  return (
    <div role="status" aria-live="polite" className="animate-pulse space-y-4">
      <span className="sr-only">Loading…</span>
      <div className="h-7 w-56 rounded-lg bg-line" />
      <div className="h-4 w-80 max-w-full rounded bg-line/70" />
      <div className="grid gap-4 pt-2 sm:grid-cols-3">
        <div className="h-24 rounded-[var(--radius-card)] bg-line/60" />
        <div className="h-24 rounded-[var(--radius-card)] bg-line/60" />
        <div className="h-24 rounded-[var(--radius-card)] bg-line/60" />
      </div>
      <div className="h-64 rounded-[var(--radius-card)] bg-line/50" />
    </div>
  );
}
