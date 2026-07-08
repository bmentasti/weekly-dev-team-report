// Domain types for GitHub Pull Requests, normalized from the REST shape.

export type PrState = "OPEN" | "MERGED" | "CLOSED";
export type ChecksState =
  | "success"
  | "failure"
  | "pending"
  | "none"
  | "unknown";

export interface NormalizedPr {
  number: number;
  title: string;
  author: string | null;
  state: PrState;
  createdAt: string;
  updatedAt: string;
  mergedAt: string | null;
  closedAt: string | null;
  url: string;
  reviewerCount: number;
  hasReviewer: boolean;
  draft: boolean;
  ageHours: number; // for open PRs: hours since creation
  checksState: ChecksState;
  // Derived flags (rules from the spec)
  isOld: boolean; // open > 72h
  isRisk: boolean; // old OR checks failing
}

export interface GitHubConnectionConfig {
  owner: string;
  repo: string;
}

// Raw GitHub REST v3 pull request shape (only the fields we read).
export interface RawGitHubPr {
  number: number;
  title: string;
  html_url: string;
  state: "open" | "closed";
  draft?: boolean;
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  closed_at: string | null;
  user?: { login?: string } | null;
  requested_reviewers?: Array<{ login?: string }>;
  requested_teams?: Array<{ name?: string }>;
  head?: { sha?: string };
}
