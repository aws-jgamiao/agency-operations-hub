import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { ActionForm, SubmitButton, TextField } from "@/components/ui/form";
import { requestPasswordReset } from "@/app/auth/actions";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Reset your password"
      description="We'll email you a link to choose a new password."
      footer={
        <Link href="/login" className="underline underline-offset-4 hover:text-ink">
          Back to sign in
        </Link>
      }
    >
      <ActionForm action={requestPasswordReset} className="space-y-4">
        <TextField name="email" label="Email" type="email" autoComplete="email" />
        <SubmitButton pendingText="Sending…">Send reset link</SubmitButton>
      </ActionForm>
    </AuthCard>
  );
}
