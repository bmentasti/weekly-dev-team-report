// Unified domain models. Every provider normalizes its data into these shapes
// so downstream analysis (per team / per person, cross-source) is provider-
// agnostic.

import type { ProviderSlug } from "./catalog";

export type WorkItemBucket = "TODO" | "IN_PROGRESS" | "DONE" | "BLOCKED";

export interface UnifiedWorkItem {
  source: ProviderSlug;
  externalId: string; // key / number / id in the source system
  title: string;
  status: string;
  bucket: WorkItemBucket;
  assignee: string | null;
  /**
   * Responsables cuando el ítem tiene más de uno (campos multi-persona / linked
   * records). Si está presente, el rollup por persona atribuye a CADA uno; si
   * no, se usa `assignee`. Evita "personas" falsas del tipo "A, B".
   */
  assignees?: string[];
  priority: string | null;
  isCritical: boolean;
  isStale: boolean; // no movement in > 5 days
  storyPoints: number | null;
  labels: string[];
  type: string | null; // Story / Bug / Task / ...
  project: string | null;
  sprint: string | null;
  url: string;
  createdAt: string | null;
  updatedAt: string | null;
  resolvedAt: string | null;
}

export type CodeChangeState = "OPEN" | "MERGED" | "CLOSED";
export type ChecksState =
  | "success"
  | "failure"
  | "pending"
  | "none"
  | "unknown";

export interface UnifiedCodeChange {
  source: ProviderSlug;
  externalId: string; // e.g. "42"
  title: string;
  author: string | null;
  state: CodeChangeState;
  reviewerCount: number;
  hasReviewer: boolean;
  checksState: ChecksState;
  draft: boolean;
  ageHours: number; // for OPEN changes: hours since creation
  isOld: boolean; // open > 72h
  isRisk: boolean; // old OR checks failing
  url: string;
  createdAt: string;
  updatedAt: string;
  mergedAt: string | null;
  closedAt: string | null;
}

export interface ActivitySignal {
  source: ProviderSlug;
  externalId: string;
  author: string | null;
  channel: string | null;
  text: string;
  isBlocker: boolean;
  url: string | null;
  createdAt: string | null;
}

export type CiStatus = "success" | "failure" | "running" | "other";

export interface CiRun {
  source: ProviderSlug;
  externalId: string;
  name: string;
  status: CiStatus;
  isDeploy: boolean;
  url: string;
  createdAt: string | null;
}

/**
 * Email conocido para un handle de la app (assignee/author). El email es la
 * clave universal de identidad: permite unificar la misma persona entre apps
 * distintas con certeza. Los adapters que puedan exponer email lo declaran acá.
 */
export interface PersonEmail {
  /** Handle tal como aparece en workItems/codeChanges (login, nombre, etc.). */
  handle: string;
  email: string;
}

export interface ProviderData {
  workItems?: UnifiedWorkItem[];
  codeChanges?: UnifiedCodeChange[];
  activity?: ActivitySignal[];
  ciRuns?: CiRun[];
  /** Directorio opcional handle → email para unificación por email. */
  personEmails?: PersonEmail[];
}

// ---------------------------------------------------------------------------
// Adapter contract (server-side)
// ---------------------------------------------------------------------------

export interface ConnectionContext {
  /** Non-secret config fields (domain, owner, repo, projectKey, teamId, ...). */
  config: Record<string, string>;
  /** The decrypted secret (API token / key). */
  secret: string;
}

export interface TestResult {
  ok: boolean;
  error?: string;
  detail?: string; // human-friendly success info (e.g. resolved name)
}

export interface FetchOptions {
  /** ISO date; providers include items updated on/after this. */
  since?: string;
}

export interface ProviderAdapter {
  slug: ProviderSlug;
  testConnection(ctx: ConnectionContext): Promise<TestResult>;
  fetchData(ctx: ConnectionContext, opts?: FetchOptions): Promise<ProviderData>;
}
