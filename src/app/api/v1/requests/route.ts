import type { NextRequest } from "next/server";
import { z } from "zod";
import { authenticate, json, problem } from "@/lib/api";
import { REQUEST_STATUSES } from "@/lib/validation/schemas";

const filters = z.object({
  status: z.enum([...REQUEST_STATUSES, "open"]).optional().catch(undefined),
  limit: z.coerce.number().int().min(1).max(100).default(50).catch(50),
});

/** GET /api/v1/requests?status=open : client requests in the caller's workspaces. */
export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (auth instanceof Response) return auth;
  const f = filters.parse(Object.fromEntries(request.nextUrl.searchParams));

  let query = auth.supabase
    .from("client_requests")
    .select("id, title, status, priority, channel, created_at, resolved_at, client:clients(id, name), workspace:workspaces(id, name), assignee:members!client_requests_assignee_id_fkey(id, full_name)")
    .order("created_at", { ascending: false })
    .limit(f.limit);
  if (f.status === "open") query = query.not("status", "in", "(resolved,closed)");
  else if (f.status) query = query.eq("status", f.status);

  const { data, error } = await query;
  if (error) return problem(500, "Could not load requests");
  return json({ data });
}
