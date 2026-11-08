import type { Metadata } from "next";
import { Logo } from "@/components/brand";
import { DemoSignIn } from "@/components/demo-sign-in";
import { LinkButton } from "@/components/ui/button";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Agency Operations Hub: demo" };

const points = [
  ["Workspace-scoped access", "Staff only see the workspaces they belong to, enforced by Postgres row-level security. Sign in as Sam, then as Chris, and compare."],
  ["Tasks with real concurrency control", "Every edit carries a version number. If someone else saved first, you get a clear conflict message instead of silently overwriting their work."],
  ["Immutable audit trail", "Database triggers record who changed what, column by column. Nobody, admins included, can edit or delete the history."],
  ["Slack notifications via an outbox", "Assignments and resolutions are queued in the same transaction, then delivered with retries, rate-limit handling and a delivery log. The demo runs in a clearly labelled mock mode."],
  ["Typed REST API", "/api/v1/tasks with filtering, keyset pagination, problem+json errors, and 409 on stale updates. It uses the same RLS as the UI."],
  ["Client requests and knowledge base", "A status workflow that requires a written resolution, internal notes, and articles restricted by role or workspace."],
] as const;

export default function Landing() {
  return (
    <div className="min-h-dvh">
      <header className="bg-rail">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Logo onDark />
          <LinkButton href="/login" size="sm">Sign in</LinkButton>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <section className="py-10 sm:py-14">
          <p className="text-sm font-medium text-brand-ink">Portfolio project · Next.js + Supabase</p>
          <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
            The internal tool an agency team uses to run the week: tasks, client requests and know-how, with a trail of who did what.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-ink-muted">
            Built to show backend engineering: relational modelling, row-level security, triggers, an outbox-based integration and a typed API.
          </p>
        </section>

        {env.NEXT_PUBLIC_DEMO_MODE && (
          <section aria-labelledby="demo" className="mb-14">
            <h2 id="demo" className="mb-3 text-lg font-semibold">Try it: pick a demo account</h2>
            <DemoSignIn />
          </section>
        )}

        <section aria-labelledby="what">
          <h2 id="what" className="mb-4 text-lg font-semibold">What to look at</h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {points.map(([title, body]) => (
              <li key={title} className="card p-5">
                <h3 className="font-medium">{title}</h3>
                <p className="mt-1.5 text-sm text-ink-muted">{body}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
