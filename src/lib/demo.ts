// Public demo accounts (shown on the landing page). Synthetic data only; the
// demo admin can restore it at any time.
export const DEMO_PASSWORD = "DemoOps!2026";

export const DEMO_ACCOUNTS = {
  admin: {
    email: "ops-admin@example.com",
    name: "Morgan Reyes",
    title: "Administrator",
    description: "Runs the team: workspaces, assignments, audit log and the Slack integration.",
  },
  sam: {
    email: "ops-sam@example.com",
    name: "Sam Patel",
    title: "Staff · Developer",
    description: "Works in Northwind website and Internal operations only.",
  },
  chris: {
    email: "ops-chris@example.com",
    name: "Chris Okafor",
    title: "Staff · Support",
    description: "Works in Harbour bookings only. Compare what Sam can see.",
  },
} as const;

export type DemoAccount = keyof typeof DEMO_ACCOUNTS;
