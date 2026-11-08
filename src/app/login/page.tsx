import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { DemoSignIn } from "@/components/demo-sign-in";
import { ActionForm, SubmitButton, TextField } from "@/components/ui/form";
import { login } from "@/app/auth/actions";
import { env } from "@/lib/env";
import { safeNext } from "@/lib/safe-redirect";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  link: "That link is invalid or has expired. Request a new one.",
  demo: "The demo account isn't available right now.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNext(params.next);
  // Same server-verified check the app pages use, so the two can never disagree.
  if ((await getSession()).state === "member") redirect(next);
  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;

  return (
    <AuthCard
      title="Sign in"
      description="Use the email and password from your invitation."
      footer={
        <Link href="/" className="underline underline-offset-4 hover:text-ink">
          Back to the demo overview
        </Link>
      }
    >
      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <ActionForm action={login} className="space-y-4" showSuccess={false}>
        <input type="hidden" name="next" value={next} />
        <TextField name="email" label="Email" type="email" autoComplete="email" />
        <TextField name="password" label="Password" type="password" autoComplete="current-password" />
        <div className="flex items-center justify-between gap-3 pt-1">
          <SubmitButton pendingText="Signing in…">Sign in</SubmitButton>
          <Link href="/forgot-password" className="text-sm text-brand-ink underline underline-offset-4">
            Forgot password?
          </Link>
        </div>
      </ActionForm>

      {env.NEXT_PUBLIC_DEMO_MODE && (
        <div className="mt-8 border-t border-line pt-6">
          <h2 className="mb-3 text-sm font-semibold text-ink">Demo accounts</h2>
          <DemoSignIn compact />
        </div>
      )}
    </AuthCard>
  );
}
