import { Logo } from "@/components/brand";
import { DesktopNav, MobileNav, type NavItem } from "@/components/app-nav";
import { Avatar } from "@/components/ui/primitives";
import { ResetDemoButton } from "@/components/reset-demo-button";
import { logout } from "@/app/auth/actions";
import { requireMember, type Member } from "@/lib/auth";
import { env } from "@/lib/env";

const STAFF_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/tasks", label: "Tasks" },
  { href: "/requests", label: "Client requests" },
  { href: "/kb", label: "Knowledge base" },
];

const ADMIN_NAV: NavItem[] = [
  ...STAFF_NAV,
  { href: "/team", label: "Team & workspaces" },
  { href: "/audit", label: "Audit log" },
  { href: "/integrations", label: "Integrations" },
];

function Account({ member, onDark }: { member: Member; onDark: boolean }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Avatar name={member.fullName} size="sm" />
        <div className="min-w-0">
          <p className={`truncate text-sm font-medium ${onDark ? "text-white" : "text-ink"}`}>{member.fullName}</p>
          <p className={`truncate text-xs ${onDark ? "text-rail-ink" : "text-ink-muted"}`}>{member.role === "admin" ? "Administrator" : "Staff"}</p>
        </div>
      </div>
      {env.NEXT_PUBLIC_DEMO_MODE && member.isDemo && member.role === "admin" && <ResetDemoButton onDark={onDark} />}
      <form action={logout}>
        <button
          type="submit"
          className={`w-full rounded-md border px-3 py-1.5 text-sm font-medium ${
            onDark ? "border-white/20 text-white hover:bg-white/10" : "border-line-strong text-ink hover:bg-canvas"
          }`}
        >
          Sign out
        </button>
      </form>
    </div>
  );
}

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const member = await requireMember();
  const nav = member.role === "admin" ? ADMIN_NAV : STAFF_NAV;

  return (
    <div className="lg:grid lg:min-h-dvh lg:grid-cols-[15rem_1fr]">
      <aside className="hidden bg-rail lg:flex lg:flex-col lg:gap-6 lg:p-4">
        <div className="px-2 pt-1">
          <Logo href="/dashboard" onDark />
        </div>
        {member.isDemo && (
          <p className="mx-2 rounded bg-white/10 px-2 py-1 text-xs text-rail-ink">Demo environment · synthetic data</p>
        )}
        <div className="flex-1">
          <DesktopNav items={nav} />
        </div>
        <div className="px-2 pb-1">
          <Account member={member} onDark />
        </div>
      </aside>

      <header className="relative flex items-center justify-between border-b border-line bg-surface px-4 py-3 lg:hidden">
        <Logo href="/dashboard" />
        <MobileNav items={nav} footer={<Account member={member} onDark={false} />} />
      </header>

      <main id="main" className="min-w-0 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
