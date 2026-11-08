import type { Metadata } from "next";
import Link from "next/link";
import { Card, PageHeader } from "@/components/ui/primitives";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getLookups } from "@/lib/lookups";
import { createTask } from "../actions";
import { TaskForm } from "../task-form";

export const metadata: Metadata = { title: "New task" };

export default async function NewTaskPage() {
  await requireAdmin();
  const { workspaces, members } = await getLookups(await createClient());
  return (
    <>
      <PageHeader eyebrow={<Link href="/tasks" className="underline">Tasks</Link>} title="New task" />
      <Card className="max-w-2xl">
        <TaskForm
          action={createTask}
          mode="create"
          workspaces={workspaces.map((w) => ({ value: w.id, label: w.name }))}
          members={members.map((m) => ({ value: m.id, label: m.full_name }))}
        />
      </Card>
    </>
  );
}
