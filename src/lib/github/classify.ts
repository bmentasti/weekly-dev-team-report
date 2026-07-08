import type {
  ChecksState,
  NormalizedPr,
  PrState,
  RawGitHubPr,
} from "./types";

// Rules from the MVP spec (section 7 & 11):
//   - PR viejo: abierto hace más de 72 horas.
//   - PR sin reviewer: abierto sin reviewers asignados.
//   - PR con riesgo: abierto hace más de 72 horas o con checks fallando.
//   - PR finalizado: mergeado dentro del período.

export const OLD_PR_HOURS = 72;

function hoursSince(dateIso: string, now: Date): number {
  const then = new Date(dateIso).getTime();
  if (Number.isNaN(then)) return 0;
  return (now.getTime() - then) / (1000 * 60 * 60);
}

export function normalizePr(
  raw: RawGitHubPr,
  checksState: ChecksState,
  now: Date = new Date(),
): NormalizedPr {
  let state: PrState;
  if (raw.merged_at) state = "MERGED";
  else if (raw.state === "closed") state = "CLOSED";
  else state = "OPEN";

  const reviewerCount =
    (raw.requested_reviewers?.length ?? 0) +
    (raw.requested_teams?.length ?? 0);

  const ageHours = state === "OPEN" ? hoursSince(raw.created_at, now) : 0;
  const isOld = state === "OPEN" && ageHours > OLD_PR_HOURS;
  const isRisk = state === "OPEN" && (isOld || checksState === "failure");

  return {
    number: raw.number,
    title: raw.title,
    author: raw.user?.login ?? null,
    state,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    mergedAt: raw.merged_at,
    closedAt: raw.closed_at,
    url: raw.html_url,
    reviewerCount,
    hasReviewer: reviewerCount > 0,
    draft: raw.draft ?? false,
    ageHours,
    checksState,
    isOld,
    isRisk,
  };
}

export interface PrSummary {
  open: number;
  merged: number;
  closedNoMerge: number;
  withoutReviewer: number;
  checksFailing: number;
  olderThan72h: number;
  avgOpenAgeHours: number;
}

export function summarizePrs(prs: NormalizedPr[]): PrSummary {
  const summary: PrSummary = {
    open: 0,
    merged: 0,
    closedNoMerge: 0,
    withoutReviewer: 0,
    checksFailing: 0,
    olderThan72h: 0,
    avgOpenAgeHours: 0,
  };

  let openAgeTotal = 0;
  for (const pr of prs) {
    if (pr.state === "OPEN") {
      summary.open++;
      openAgeTotal += pr.ageHours;
      if (!pr.hasReviewer) summary.withoutReviewer++;
      if (pr.checksState === "failure") summary.checksFailing++;
      if (pr.isOld) summary.olderThan72h++;
    } else if (pr.state === "MERGED") {
      summary.merged++;
    } else {
      summary.closedNoMerge++;
    }
  }

  summary.avgOpenAgeHours =
    summary.open > 0 ? Math.round(openAgeTotal / summary.open) : 0;

  return summary;
}
