import type { Metadata } from "next";
import { AuthCard } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { logout } from "@/app/auth/actions";

export const metadata: Metadata = { title: "No access" };

export default function NoAccessPage() {
  return (
    <AuthCard
      title="Your account doesn't have access"
      description="You're signed in, but this account isn't an active member of the operations team. Ask an administrator to add or reactivate you."
    >
      <form action={logout}>
        <Button type="submit" variant="secondary">
          Sign out
        </Button>
      </form>
    </AuthCard>
  );
}
