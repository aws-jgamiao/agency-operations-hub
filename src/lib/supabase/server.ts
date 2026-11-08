import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import type { Database } from "@/lib/database.types";

/**
 * Supabase client bound to the current request's session cookies.
 * Every query runs as the signed-in user, so Postgres RLS applies to all of
 * them. There is deliberately no service-role client in this codebase.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database, "ops">(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      db: { schema: "ops" },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // The proxy refreshes the session, so this is safe to ignore.
          }
        },
      },
    },
  );
}

export type OpsClient = Awaited<ReturnType<typeof createClient>>;
