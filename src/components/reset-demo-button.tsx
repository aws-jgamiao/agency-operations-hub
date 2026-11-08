"use client";

import { useActionState } from "react";
import { resetDemoData } from "@/app/(app)/demo-actions";
import { idle } from "@/lib/action-state";

export function ResetDemoButton({ onDark }: { onDark: boolean }) {
  const [state, action, pending] = useActionState(resetDemoData, idle);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Restore all sample data? Changes made in the demo will be lost.")) e.preventDefault();
      }}
    >
      <button
        type="submit"
        disabled={pending}
        className={`w-full rounded-md border border-dashed px-3 py-1.5 text-sm disabled:opacity-60 ${
          onDark ? "border-white/25 text-rail-ink hover:bg-white/5" : "border-line-strong text-ink-muted hover:bg-canvas"
        }`}
      >
        {pending ? "Restoring…" : "Reset demo data"}
      </button>
      <p role="status" className={state.status === "idle" ? "sr-only" : `mt-1 text-xs ${onDark ? "text-rail-ink" : "text-ink-muted"}`}>
        {state.status === "idle" ? "" : state.message}
      </p>
    </form>
  );
}
