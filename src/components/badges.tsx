import { Badge } from "@/components/ui/primitives";
import {
  PRIORITY_LABEL,
  REQUEST_STATUS_LABEL,
  TASK_STATUS_LABEL,
  type DueState,
  type Priority,
  type RequestStatus,
  type TaskStatus,
} from "@/lib/format";

const TASK_TONE: Record<TaskStatus, "neutral" | "info" | "danger" | "ok"> = { todo: "neutral", in_progress: "info", blocked: "danger", done: "ok" };
const PRIORITY_TONE: Record<Priority, "neutral" | "info" | "warn" | "danger"> = { low: "neutral", medium: "info", high: "warn", urgent: "danger" };
const REQUEST_TONE: Record<RequestStatus, "neutral" | "info" | "warn" | "ok" | "brand"> = {
  new: "brand",
  triaged: "info",
  in_progress: "info",
  waiting_on_client: "warn",
  resolved: "ok",
  closed: "neutral",
};

export const TaskStatusBadge = ({ status }: { status: TaskStatus }) => <Badge tone={TASK_TONE[status]}>{TASK_STATUS_LABEL[status]}</Badge>;
export const PriorityBadge = ({ priority }: { priority: Priority }) => <Badge tone={PRIORITY_TONE[priority]}>{PRIORITY_LABEL[priority]}</Badge>;
export const RequestStatusBadge = ({ status }: { status: RequestStatus }) => <Badge tone={REQUEST_TONE[status]}>{REQUEST_STATUS_LABEL[status]}</Badge>;
export const DueBadge = ({ due }: { due: DueState }) => <Badge tone={due.tone}>{due.text}</Badge>;
