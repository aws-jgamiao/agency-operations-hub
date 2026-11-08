import { z } from "zod";

export const uuid = z.uuid({ message: "Invalid identifier." });
export const email = z.string().trim().toLowerCase().pipe(z.email({ message: "Enter a valid email address." }));
export const password = z.string().min(8, "Password must be at least 8 characters.").max(72, "Password must be 72 characters or fewer.");

const text = (min: number, max: number, label: string) =>
  z.string().trim().min(min, min === 1 ? `${label} is required.` : `${label} must be at least ${min} characters.`).max(max, `${label} must be ${max} characters or fewer.`);

const optionalDate = z
  .union([z.iso.date({ message: "Enter a valid date (YYYY-MM-DD)." }), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? v : null));

const optionalUuid = z
  .union([uuid, z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? v : null));

export const TASK_STATUSES = ["todo", "in_progress", "blocked", "done"] as const;
export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export const REQUEST_STATUSES = ["new", "triaged", "in_progress", "waiting_on_client", "resolved", "closed"] as const;
export const CHANNELS = ["email", "phone", "portal", "meeting"] as const;

export const loginSchema = z.object({ email, password: z.string().min(1, "Enter your password.") });
export const forgotPasswordSchema = z.object({ email });
export const resetPasswordSchema = z
  .object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "Passwords don't match.", path: ["confirm"] });

export const createTaskSchema = z.object({
  workspaceId: uuid,
  title: text(2, 160, "Title"),
  description: z.string().trim().max(8000).default(""),
  status: z.enum(TASK_STATUSES).default("todo"),
  priority: z.enum(PRIORITIES).default("medium"),
  assigneeId: optionalUuid,
  dueDate: optionalDate,
});

/** PATCH body: every field optional, `version` required for optimistic concurrency. */
export const updateTaskSchema = z
  .object({
    version: z.coerce.number().int().positive(),
    title: text(2, 160, "Title").optional(),
    description: z.string().trim().max(8000).optional(),
    status: z.enum(TASK_STATUSES).optional(),
    priority: z.enum(PRIORITIES).optional(),
    assigneeId: optionalUuid,
    dueDate: optionalDate,
  })
  .strict();

export const commentSchema = z.object({ body: text(1, 4000, "Comment") });

export const taskFiltersSchema = z.object({
  status: z.enum([...TASK_STATUSES, "open"]).optional().catch(undefined),
  priority: z.enum(PRIORITIES).optional().catch(undefined),
  assignee: z.union([z.literal("me"), z.literal("unassigned"), uuid]).optional().catch(undefined),
  workspace: uuid.optional().catch(undefined),
  due: z.enum(["overdue", "week", "none"]).optional().catch(undefined),
  q: z.string().trim().max(80).optional().catch(undefined),
  cursor: z.string().max(200).optional().catch(undefined),
  limit: z.coerce.number().int().min(1).max(100).default(25).catch(25),
});
export type TaskFilters = z.infer<typeof taskFiltersSchema>;

export const createRequestSchema = z.object({
  clientId: uuid,
  workspaceId: uuid,
  title: text(2, 160, "Title"),
  body: z.string().trim().max(8000).default(""),
  channel: z.enum(CHANNELS).default("email"),
  priority: z.enum(PRIORITIES).default("medium"),
  assigneeId: optionalUuid,
});

export const updateRequestSchema = z
  .object({
    version: z.coerce.number().int().positive(),
    status: z.enum(REQUEST_STATUSES),
    resolution: z.string().trim().max(4000).optional().transform((v) => (v ? v : null)),
    assigneeId: optionalUuid,
    priority: z.enum(PRIORITIES).optional(),
  })
  .refine((v) => !["resolved", "closed"].includes(v.status) || Boolean(v.resolution), {
    message: "Describe how the request was resolved.",
    path: ["resolution"],
  });

export const articleSchema = z
  .object({
    categoryId: uuid,
    title: text(2, 160, "Title"),
    slug: z.string().trim().toLowerCase().max(80).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens."),
    body: z.string().max(20000, "Article is too long."),
    visibility: z.enum(["all_staff", "admins", "workspace"]),
    workspaceId: optionalUuid,
    published: z
      .union([z.literal("on"), z.literal("true"), z.literal("")])
      .optional()
      .transform((v) => v === "on" || v === "true"),
  })
  .refine((v) => (v.visibility === "workspace") === Boolean(v.workspaceId), {
    message: "Choose a workspace for workspace-only articles (and only for those).",
    path: ["workspaceId"],
  });

export const workspaceSchema = z.object({ name: text(2, 80, "Name"), clientId: optionalUuid });
export const clientSchema = z.object({
  name: text(2, 120, "Name"),
  contactEmail: z.union([email, z.literal("")]).optional().transform((v) => (v ? v : null)),
});
