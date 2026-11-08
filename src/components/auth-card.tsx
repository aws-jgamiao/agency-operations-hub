import type { ReactNode } from "react";
import { Logo } from "@/components/brand";

export function AuthCard({ title, description, children, footer }: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center px-4 py-10 sm:justify-center">
      <div className="mb-8">
        <Logo />
      </div>
      <main id="main" className="card w-full max-w-md p-6 sm:p-8">
        <h1 className="text-xl font-semibold text-ink">{title}</h1>
        {description && <p className="mt-1 text-[0.9375rem] text-ink-muted">{description}</p>}
        <div className="mt-6">{children}</div>
      </main>
      {footer && <div className="mt-6 w-full max-w-md text-center text-sm text-ink-muted">{footer}</div>}
    </div>
  );
}
