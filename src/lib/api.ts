import "server-only";
import { createClient as createSupabase } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import type { z } from "zod";
import { env } from "@/lib/env";
import { createClient, type OpsClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

/** RFC 9457 / 7807 problem details. Messages are generic; no internals leak. */
export function problem(status: number, title: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json(
    { type: "about:blank", title, status, ...extra },
    { status, headers: { "Content-Type": "application/problem+json", "Cache-Control": "no-store" } },
  );
}

export function validationProblem(error: z.ZodError) {
  return problem(422, "Validation failed", {
    errors: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
  });
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

type ApiAuth = { supabase: OpsClient; userId: string; via: "bearer" | "cookie" };

/**
 * Authenticates an API request with either:
 *   - `Authorization: Bearer <Supabase access token>` (scripts, curl), or
 *   - the browser session cookie.
 * Either way the token is verified with the Auth server, and every query runs
 * with it, so RLS decides what the caller can see and change.
 */
export async function authenticate(request: NextRequest): Promise<ApiAuth | NextResponse> {
  const header = request.headers.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) {
    const token = header.slice(7).trim();
    const supabase = createSupabase<Database, "ops">(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
      db: { schema: "ops" },
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return problem(401, "Invalid or expired token");
    return { supabase: supabase as unknown as OpsClient, userId: data.user.id, via: "bearer" };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return problem(401, "Authentication required");
  return { supabase, userId: data.user.id, via: "cookie" };
}

/**
 * CSRF protection for cookie-authenticated writes: the Origin header must
 * match this site. Bearer-token requests are exempt because a browser never
 * attaches that header cross-site.
 */
export function checkOrigin(request: NextRequest, auth: ApiAuth): NextResponse | null {
  if (auth.via === "bearer") return null;
  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin) return problem(403, "Cross-origin request rejected");
  return null;
}

export async function readJson(request: NextRequest): Promise<unknown | NextResponse> {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return problem(415, "Content-Type must be application/json");
  }
  const text = await request.text();
  if (text.length > 64_000) return problem(413, "Request body too large");
  try {
    return JSON.parse(text);
  } catch {
    return problem(400, "Malformed JSON");
  }
}
