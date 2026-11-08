"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { getSession } from "@/lib/auth";
import { DEMO_ACCOUNTS, DEMO_PASSWORD, type DemoAccount } from "@/lib/demo";
import { safeNext } from "@/lib/safe-redirect";
import { failure, success, validationFailure, type ActionState } from "@/lib/action-state";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
} from "@/lib/validation/schemas";

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // Same message for unknown email and wrong password (no account enumeration).
    return failure("Email or password is incorrect.");
  }
  redirect(safeNext(formData.get("next")));
}

export async function demoLogin(account: DemoAccount): Promise<void> {
  // Server Action arguments are attacker-controlled: check own keys only.
  if (!env.NEXT_PUBLIC_DEMO_MODE || !Object.hasOwn(DEMO_ACCOUNTS, account)) redirect("/login");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: DEMO_ACCOUNTS[account].email,
    password: DEMO_PASSWORD,
  });
  if (error) redirect("/login?error=demo");
  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${env.NEXT_PUBLIC_SITE_URL}/auth/confirm?next=/reset-password`,
  });
  if (error && error.status === 429) {
    return failure("Too many requests. Please wait a few minutes and try again.");
  }
  // Identical response whether or not the account exists.
  return success("If an account exists for that email, a reset link is on its way.");
}

export async function updatePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return validationFailure(parsed.error);

  const session = await getSession();
  if (session.state === "signed-out") {
    return failure("Your reset link has expired. Request a new one.");
  }
  if (session.state === "member" && session.member.isDemo) {
    return failure("Demo account passwords can't be changed.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return failure("We couldn't update your password. Try a different one.");
  redirect("/dashboard");
}

