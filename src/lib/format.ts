import type { Database } from "@/lib/database.types";

type Enums = Database["ops"]["Enums"];
export type TaskStatus = Enums["task_status"];
export type Priority = Enums["priority"];
export type RequestStatus = Enums["request_status"];

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
};
export const PRIORITY_LABEL: Record<Priority, string> = { low: "Low", medium: "Medium", high: "High", urgent: "Urgent" };
export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  new: "New",
  triaged: "Triaged",
  in_progress: "In progress",
  waiting_on_client: "Waiting on client",
  resolved: "Resolved",
  closed: "Closed",
};

/** The agency works in Sydney time; "today" and "overdue" use this zone everywhere. */
export const AGENCY_TIME_ZONE = "Australia/Sydney";

function ymd(value: string): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) throw new RangeError(`Invalid date: ${value}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** Today's calendar date (YYYY-MM-DD) in the agency's time zone. */
export function agencyToday(now: Date = new Date(), timeZone = AGENCY_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(now);
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = ymd(date);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  const [y1, m1, d1] = ymd(from);
  const [y2, m2, d2] = ymd(to);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

const dateFmt = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short" });
const dateTimeFmt = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: AGENCY_TIME_ZONE,
});

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const [y, m, d] = ymd(value);
  return dateFmt.format(new Date(y, m - 1, d));
}

export function formatDateTime(value: string): string {
  return dateTimeFmt.format(new Date(value));
}

export type DueState = { text: string; tone: "neutral" | "warn" | "danger" | "ok" };

export function dueState(due: string | null, done: boolean, today: string = agencyToday()): DueState {
  if (done) return { text: "Done", tone: "ok" };
  if (!due) return { text: "No due date", tone: "neutral" };
  const days = daysBetween(today, due);
  if (days < 0) return { text: `${-days}d overdue`, tone: "danger" };
  if (days === 0) return { text: "Due today", tone: "warn" };
  if (days <= 2) return { text: `Due in ${days}d`, tone: "warn" };
  return { text: formatDate(due), tone: "neutral" };
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}
