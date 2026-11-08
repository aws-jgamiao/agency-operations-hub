import Link from "next/link";

export function Logo({ href = "/", onDark = false }: { href?: string; onDark?: boolean }) {
  return (
    <Link href={href} className={`inline-flex items-center gap-2.5 font-semibold ${onDark ? "text-white" : "text-ink"}`}>
      <svg aria-hidden="true" viewBox="0 0 32 32" className="size-7">
        <rect width="32" height="32" rx="7" fill="var(--color-brand)" />
        <path d="M8 22V10m8 12V14m8 8v-5" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      </svg>
      <span>
        Ops Hub <span className={`font-normal ${onDark ? "text-rail-ink" : "text-ink-muted"}`}>for agencies</span>
      </span>
    </Link>
  );
}
