"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export type NavItem = { href: string; label: string };

function NavLinks({ items, onNavigate, dark = false }: { items: NavItem[]; onNavigate?: () => void; dark?: boolean }) {
  const pathname = usePathname();
  return (
    <ul className="space-y-0.5">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`block rounded-md px-3 py-1.5 text-sm ${
                dark
                  ? active
                    ? "bg-white/10 font-medium text-white"
                    : "text-rail-ink hover:bg-white/5 hover:text-white"
                  : active
                    ? "bg-brand-soft font-medium text-brand-ink"
                    : "text-ink-muted hover:bg-line/50 hover:text-ink"
              }`}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function DesktopNav({ items }: { items: NavItem[] }) {
  return (
    <nav aria-label="Main">
      <NavLinks items={items} dark />
    </nav>
  );
}

export function MobileNav({ items, footer }: { items: NavItem[]; footer: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // Close the menu when the route changes (including back/forward), using the
  // "adjust state during render" pattern instead of an effect.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-nav"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-10 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 text-sm font-medium"
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
          {open ? <path d="M5 5l10 10M15 5L5 15" /> : <path d="M3 6h14M3 10h14M3 14h14" />}
        </svg>
        Menu
      </button>
      {open && (
        <nav id="mobile-nav" aria-label="Main" className="absolute inset-x-0 top-full z-40 border-b border-line bg-surface px-4 py-3 shadow-lg">
          <NavLinks items={items} onNavigate={() => setOpen(false)} />
          <div className="mt-3 border-t border-line pt-3">{footer}</div>
        </nav>
      )}
    </div>
  );
}
