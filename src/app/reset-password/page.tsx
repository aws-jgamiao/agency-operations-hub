import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { ActionForm, SubmitButton, TextField } from "@/components/ui/form";
import { updatePassword } from "@/app/auth/actions";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  const session = await getSession();

  if (session.state === "signed-out") {
    return (
      <AuthCard title="Link expired" description="This password reset link is no longer valid.">
        <Link href="/forgot-password" className="text-brand-ink underline underline-offset-4">
          Request a new reset link
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password" description="Use at least 8 characters.">
      <ActionForm action={updatePassword} className="space-y-4">
        <TextField name="password" label="New password" type="password" autoComplete="new-password" minLength={8} />
        <TextField name="confirm" label="Confirm new password" type="password" autoComplete="new-password" />
        <SubmitButton pendingText="Updating…">Update password</SubmitButton>
      </ActionForm>
    </AuthCard>
  );
}
