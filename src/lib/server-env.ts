import "server-only";
import { z } from "zod";

// Server-only secrets. `server-only` makes any import from a Client Component
// a build error, so these values can never reach the browser bundle.
const schema = z.object({
  // Slack incoming-webhook URL. Unset => mock mode (deliveries are recorded, not sent).
  SLACK_WEBHOOK_URL: z
    .url()
    .refine((u) => u.startsWith("https://hooks.slack.com/"), "Must be a https://hooks.slack.com/ webhook URL")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export const serverEnv = schema.parse({ SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL });
