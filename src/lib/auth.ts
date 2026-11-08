import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type Role = Database["ops"]["Enums"]["member_role"];
export type Member = { id: string; email: string; fullName: string; role: Role; isDemo: boolean };

type Session = { state: "signed-out" } | { state: "no-access" } | { state: "member"; member: Member };

/** Verifies the session with the Auth server and loads the active member row (RLS applies). */
export const getSession = cache(async (): Promise<Session> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { state: "signed-out" };
  const { data } = await supabase
    .from("members")
    .select("id, email, full_name, role, active, is_demo")
    .eq("id", user.id)
    .maybeSingle();
  if (!data || !data.active) return { state: "no-access" };
  return { state: "member", member: { id: data.id, email: data.email, fullName: data.full_name, role: data.role, isDemo: data.is_demo } };
});

export async function requireMember(): Promise<Member> {
  const s = await getSession();
  if (s.state === "signed-out") redirect("/login");
  if (s.state === "no-access") redirect("/no-access");
  return s.member;
}

/** Admin-only pages 404 for staff (existence is not advertised). */
export async function requireAdmin(): Promise<Member> {
  const m = await requireMember();
  if (m.role !== "admin") notFound();
  return m;
}
