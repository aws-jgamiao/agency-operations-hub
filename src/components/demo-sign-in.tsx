import { demoLogin } from "@/app/auth/actions";
import { DEMO_ACCOUNTS, DEMO_PASSWORD, type DemoAccount } from "@/lib/demo";
import { Avatar } from "@/components/ui/primitives";

export function DemoSignIn({ compact = false }: { compact?: boolean }) {
  const accounts = Object.entries(DEMO_ACCOUNTS) as [DemoAccount, (typeof DEMO_ACCOUNTS)[DemoAccount]][];
  return (
    <div>
      <ul className={compact ? "space-y-2" : "grid gap-3 md:grid-cols-3"}>
        {accounts.map(([key, account]) => (
          <li key={key}>
            <form action={demoLogin.bind(null, key)}>
              <button
                type="submit"
                className="card flex w-full items-start gap-3 p-4 text-left transition-colors hover:border-brand hover:bg-brand-soft/40"
              >
                <Avatar name={account.name} />
                <span className="min-w-0">
                  <span className="block font-medium text-ink">
                    Sign in as {account.name}
                  </span>
                  <span className="block text-sm text-brand-ink">{account.title}</span>
                  {!compact && <span className="mt-1 block text-sm text-ink-muted">{account.description}</span>}
                </span>
              </button>
            </form>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-ink-muted">
        Or sign in manually with any demo email above and the password{" "}
        <code className="rounded bg-line/60 px-1.5 py-0.5 text-ink">{DEMO_PASSWORD}</code>. The demo admin
        can restore the sample data at any time.
      </p>
    </div>
  );
}
