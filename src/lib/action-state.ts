import type { z } from "zod";

export type ActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string; fieldErrors?: Record<string, string[]> };

export const idle: ActionState = { status: "idle" };

export function success(message: string): ActionState {
  return { status: "success", message };
}

export function failure(message: string, fieldErrors?: Record<string, string[]>): ActionState {
  return { status: "error", message, fieldErrors };
}

export function validationFailure(error: z.ZodError): ActionState {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return failure("Please correct the highlighted fields.", fieldErrors);
}

type DbError = { code?: string | null; message?: string } | null | undefined;

/**
 * Maps database errors to safe, generic messages. A row that belongs to
 * another organization and a row that does not exist produce the SAME
 * message, so responses never confirm that someone else's record exists.
 */
export function dbErrorMessage(error: DbError): string {
  switch (error?.code) {
    case "42501":
    case "PGRST301":
      return "You don't have permission to do that.";
    case "P0002":
    case "PGRST116":
      return "We couldn't find that item.";
    case "23505":
      return "That already exists.";
    case "23514":
    case "22023":
    case "23502":
      return "Some of the values weren't accepted.";
    case "23503":
      return "That item is linked to something that doesn't exist.";
    default:
      return "Something went wrong. Please try again.";
  }
}

/** Server-side log with the error code only: never request bodies, tokens or personal data. */
export function logDbError(context: string, error: DbError) {
  console.error(`[db] ${context} failed (code=${error?.code ?? "unknown"})`);
}
