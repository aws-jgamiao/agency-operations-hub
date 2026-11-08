import Link from "next/link";
import { Logo } from "@/components/brand";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <Logo />
      <main id="main" className="mt-10 max-w-md">
        <p className="text-sm font-medium text-brand-ink">404</p>
        <h1 className="mt-1 text-2xl font-semibold text-ink">We couldn&apos;t find that page</h1>
        <p className="mt-2 text-ink-muted">It may have been moved or deleted, or you may not have access to it.</p>
        <Link href="/dashboard" className="mt-6 inline-block text-brand-ink underline underline-offset-4">
          Go to your overview
        </Link>
      </main>
    </div>
  );
}
