import type {
  IssueBucket,
  NormalizedIssue,
  RawJiraIssue,
} from "./types";
import { assigneeChanges, assigneeAt, wasReassigned } from "./assignment-history";

// Rules from the MVP spec (section 6 & 11):
//   - Stale (sin movimiento): not updated in more than 5 days.
//   - Blocked: status "Blocked" or label "blocked".
//   - Critical: priority High / Highest / Critical (or similar).
//   - Done: status category "done" (Done / Closed / Resolved / equivalent).

export const STALE_DAYS = 5;

const CRITICAL_PRIORITIES = new Set([
  "highest",
  "high",
  "critical",
  "blocker",
]);

const BLOCKED_STATUS_NAMES = new Set(["blocked", "bloqueado", "on hold"]);
const BLOCKED_LABELS = new Set(["blocked", "bloqueado"]);

function daysSince(dateIso: string | null | undefined, now: Date): number {
  if (!dateIso) return Number.POSITIVE_INFINITY;
  const then = new Date(dateIso).getTime();
  if (Number.isNaN(then)) return Number.POSITIVE_INFINITY;
  return (now.getTime() - then) / (1000 * 60 * 60 * 24);
}

function normalizeCategory(
  key: string | undefined,
): NormalizedIssue["statusCategory"] {
  if (key === "new" || key === "indeterminate" || key === "done") return key;
  return "unknown";
}

/**
 * Try to read story points from common custom-field ids. Different Jira sites
 * expose story points under different customfield_* keys, so we probe the usual
 * ones and fall back to null.
 */
function extractStoryPoints(fields: RawJiraIssue["fields"]): number | null {
  const candidates = [
    "customfield_10016",
    "customfield_10026",
    "customfield_10004",
    "story_points",
  ];
  for (const key of candidates) {
    const value = fields[key];
    if (typeof value === "number") return value;
  }
  return null;
}

function extractSprint(fields: RawJiraIssue["fields"]): string | null {
  const candidates = ["customfield_10020", "customfield_10010", "sprint"];
  for (const key of candidates) {
    const value = fields[key];
    if (Array.isArray(value) && value.length > 0) {
      const last = value[value.length - 1];
      if (last && typeof last === "object" && "name" in last) {
        return String((last as { name: unknown }).name);
      }
      if (typeof last === "string") return last;
    }
  }
  return null;
}

export function normalizeIssue(
  raw: RawJiraIssue,
  domain: string,
  now: Date = new Date(),
): NormalizedIssue {
  const fields = raw.fields ?? {};
  const statusName = fields.status?.name ?? "";
  const statusCategory = normalizeCategory(
    fields.status?.statusCategory?.key,
  );
  const labels = fields.labels ?? [];
  const priority = fields.priority?.name ?? null;

  const isBlocked =
    BLOCKED_STATUS_NAMES.has(statusName.toLowerCase()) ||
    labels.some((l) => BLOCKED_LABELS.has(l.toLowerCase()));

  const isCritical = priority
    ? CRITICAL_PRIORITIES.has(priority.toLowerCase())
    : false;

  const isDone = statusCategory === "done";

  const isStale = !isDone && daysSince(fields.updated, now) > STALE_DAYS;

  // §5: para una tarea resuelta, el responsable a atribuir es quien lo era al
  // resolverse (según changelog), no el assignee actual si cambió después.
  const currentAssignee = fields.assignee?.displayName ?? null;
  const changes = assigneeChanges(raw.changelog);
  const resolutionMs = fields.resolutiondate
    ? new Date(fields.resolutiondate).getTime()
    : null;
  const assigneeAtResolution =
    isDone && changes.length > 0
      ? assigneeAt(currentAssignee, changes, resolutionMs)
      : undefined;
  const reassigned = changes.length > 0 ? wasReassigned(changes, null) : undefined;

  let bucket: IssueBucket;
  if (isBlocked && !isDone) {
    bucket = "BLOCKED";
  } else if (isDone) {
    bucket = "DONE";
  } else if (statusCategory === "indeterminate") {
    bucket = "IN_PROGRESS";
  } else {
    bucket = "TODO";
  }

  return {
    key: raw.key,
    summary: fields.summary ?? "(sin título)",
    status: statusName || "Desconocido",
    statusCategory,
    assignee: currentAssignee,
    priority,
    issueType: fields.issuetype?.name ?? null,
    labels,
    storyPoints: extractStoryPoints(fields),
    sprint: extractSprint(fields),
    createdAt: fields.created ?? null,
    updatedAt: fields.updated ?? null,
    resolvedAt: fields.resolutiondate ?? null,
    url: `https://${domain}/browse/${raw.key}`,
    bucket,
    isBlocked,
    isCritical,
    isStale,
    assigneeAtResolution,
    reassigned,
  };
}

export interface IssueSummary {
  total: number;
  done: number;
  inProgress: number;
  blocked: number;
  todo: number;
  stale: number;
  critical: number;
  byAssignee: Record<string, number>;
}

export function summarizeIssues(issues: NormalizedIssue[]): IssueSummary {
  const summary: IssueSummary = {
    total: issues.length,
    done: 0,
    inProgress: 0,
    blocked: 0,
    todo: 0,
    stale: 0,
    critical: 0,
    byAssignee: {},
  };

  for (const issue of issues) {
    if (issue.bucket === "DONE") summary.done++;
    else if (issue.bucket === "IN_PROGRESS") summary.inProgress++;
    else if (issue.bucket === "BLOCKED") summary.blocked++;
    else summary.todo++;

    if (issue.isStale) summary.stale++;
    if (issue.isCritical) summary.critical++;

    const who = issue.assignee ?? "Sin asignar";
    summary.byAssignee[who] = (summary.byAssignee[who] ?? 0) + 1;
  }

  return summary;
}
