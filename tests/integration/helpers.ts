import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/lib/database.types";

try {
  process.loadEnvFile(".env.local");
} catch {
  // CI provides the variables directly.
}

export const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
export const PASSWORD = "DemoOps!2026";
export const USERS = {
  admin: "ops-admin@example.com",
  sam: "ops-sam@example.com",
  lena: "ops-lena@example.com",
  chris: "ops-chris@example.com",
} as const;
export const WS = {
  north: "0e000000-0000-4000-8000-0000000000a1",
  harb: "0e000000-0000-4000-8000-0000000000a2",
  internal: "0e000000-0000-4000-8000-0000000000a3",
} as const;

export type Client = SupabaseClient<Database, "ops">;

export async function signedIn(email: string): Promise<{ client: Client; token: string }> {
  const client = createClient<Database, "ops">(URL, KEY, { db: { schema: "ops" }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.session) throw new Error(`sign-in failed for ${email}: ${error?.message}`);
  return { client, token: data.session.access_token };
}

export async function resetDemo() {
  const { client } = await signedIn(USERS.admin);
  const { error } = await client.rpc("reset_demo");
  if (error) throw new Error(`reset_demo failed: ${error.message}`);
}
