"use client";

import { Button } from "@/components/ui/button";

export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  // Server errors arrive with a generic message and a digest; never show internals.
  const digest = error instanceof Error && "digest" in error ? String((error as Error & { digest?: string }).digest ?? "") : "";
  return (
    <div role="alert" className="card mx-auto max-w-lg p-8 text-center">
      <h1 className="text-xl font-semibold text-ink">Something went wrong</h1>
      <p className="mt-2 text-ink-muted">This page couldn&apos;t be loaded. Try again, or come back in a minute.</p>
      {digest && <p className="mt-2 text-xs text-ink-subtle">Reference: {digest}</p>}
      <Button className="mt-6" onClick={() => retry()}>
        Try again
      </Button>
    </div>
  );
}
