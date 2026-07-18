import { fetchWithRetry } from "@/lib/http";
import { normalizeIssue } from "./classify";
import type {
  JiraConnectionConfig,
  NormalizedIssue,
  RawJiraIssue,
} from "./types";

// JiraIntegrationService — thin server-side client for Jira Cloud REST v3.
// Authenticates with Basic auth (email + API token). Never called from the
// browser; tokens live encrypted in the DB and are decrypted only here.
//
// Supports both flavours of Atlassian account API tokens:
//   - Classic (unscoped) tokens, which authenticate against the instance URL
//     (https://empresa.atlassian.net/rest/...).
//   - Scoped / granular tokens (the only kind service accounts can create),
//     which MUST be routed through the API gateway
//     (https://api.atlassian.com/ex/jira/<cloudId>/rest/...).
// We resolve the right base URL automatically: we try the instance URL first
// and, on 401/403, fall back to the gateway using the site's cloudId.

const JIRA_FIELDS = [
  "summary",
  "status",
  "assignee",
  "priority",
  "issuetype",
  "labels",
  "created",
  "updated",
  "resolutiondate",
];

export function normalizeDomain(input: string): string {
  return input
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "")
    .toLowerCase();
}

export function isValidDomain(domain: string): boolean {
  // e.g. empresa.atlassian.net (allow custom domains too, but require a dot).
  return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain);
}

function authHeader(email: string, apiToken: string): string {
  const token = Buffer.from(`${email}:${apiToken}`).toString("base64");
  return `Basic ${token}`;
}

/**
 * Low-level fetch against a fully-qualified Jira API base URL.
 * `base` is either https://<domain> (classic) or
 * https://api.atlassian.com/ex/jira/<cloudId> (scoped).
 */
async function jiraFetch(
  base: string,
  path: string,
  email: string,
  apiToken: string,
  init?: RequestInit,
): Promise<Response> {
  const url = `${base}${path}`;
  // fetchWithRetry agrega timeout duro + exponential backoff en 429/5xx y respeta
  // Retry-After. La búsqueda de Jira (POST /search) es idempotente, así que es
  // seguro reintentarla.
  return fetchWithRetry(url, {
    ...init,
    headers: {
      Authorization: authHeader(email, apiToken),
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    // Never cache Jira responses.
    cache: "no-store",
  });
}

/**
 * Resolves the site's cloudId via the public tenant_info edge endpoint.
 * This endpoint requires no authentication. Returns null if unavailable.
 */
async function fetchCloudId(domain: string): Promise<string | null> {
  try {
    const res = await fetch(`https://${domain}/_edge/tenant_info`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { cloudId?: string };
    return data.cloudId ?? null;
  } catch {
    return null;
  }
}

interface ResolvedBase {
  /** Base URL to prefix REST paths with (no trailing slash). */
  base: string;
  /** The `/myself` response for the chosen base, so callers can reuse it. */
  meRes: Response;
  /** True when we fell back to the scoped-token API gateway. */
  scoped: boolean;
}

/**
 * Picks the correct API base URL for the given credentials.
 *
 * Strategy: try the instance URL first (works for classic tokens). If Jira
 * answers 401/403 there, resolve the site's cloudId and retry through the
 * gateway (works for scoped/granular tokens). Returns whichever `/myself`
 * response we obtained so callers don't have to probe again.
 */
async function resolveApiBase(
  domain: string,
  email: string,
  apiToken: string,
): Promise<ResolvedBase> {
  const instanceBase = `https://${domain}`;
  const meRes = await jiraFetch(
    instanceBase,
    "/rest/api/3/myself",
    email,
    apiToken,
  );

  // Classic token (or already authorized): use the instance URL.
  if (meRes.status !== 401 && meRes.status !== 403) {
    return { base: instanceBase, meRes, scoped: false };
  }

  // 401/403 on the instance URL — likely a scoped token. Try the gateway.
  const cloudId = await fetchCloudId(domain);
  if (!cloudId) {
    // Could not resolve cloudId; surface the original (instance) response.
    return { base: instanceBase, meRes, scoped: false };
  }

  const gatewayBase = `https://api.atlassian.com/ex/jira/${cloudId}`;
  const gatewayMeRes = await jiraFetch(
    gatewayBase,
    "/rest/api/3/myself",
    email,
    apiToken,
  );
  return { base: gatewayBase, meRes: gatewayMeRes, scoped: true };
}

export interface TestConnectionResult {
  ok: boolean;
  error?: string;
  accountDisplayName?: string;
  projectName?: string;
}

/**
 * Validates credentials and that the project key exists / is accessible.
 */
export async function testJiraConnection(
  config: JiraConnectionConfig,
  apiToken: string,
): Promise<TestConnectionResult> {
  const domain = normalizeDomain(config.domain);
  if (!isValidDomain(domain)) {
    return { ok: false, error: "El dominio no tiene un formato válido." };
  }
  if (!apiToken.trim()) {
    return { ok: false, error: "El API token no puede estar vacío." };
  }

  try {
    // 1. Auth check — resolves the correct base URL (instance vs. gateway).
    const { base, meRes } = await resolveApiBase(domain, config.email, apiToken);
    if (meRes.status === 401 || meRes.status === 403) {
      return { ok: false, error: "Credenciales inválidas (email o token)." };
    }
    if (!meRes.ok) {
      return {
        ok: false,
        error: `Jira respondió con estado ${meRes.status}.`,
      };
    }
    const me = (await meRes.json()) as { displayName?: string };

    // 2. Project access check.
    const projectRes = await jiraFetch(
      base,
      `/rest/api/3/project/${encodeURIComponent(config.projectKey)}`,
      config.email,
      apiToken,
    );
    if (projectRes.status === 404) {
      return {
        ok: false,
        error: `No se encontró el proyecto "${config.projectKey}".`,
      };
    }
    if (!projectRes.ok) {
      return {
        ok: false,
        error: `No se pudo acceder al proyecto (estado ${projectRes.status}).`,
      };
    }
    const project = (await projectRes.json()) as { name?: string };

    return {
      ok: true,
      accountDisplayName: me.displayName,
      projectName: project.name,
    };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? `Error de red al conectar con Jira: ${err.message}`
          : "Error desconocido al conectar con Jira.",
    };
  }
}

export interface FetchIssuesOptions {
  /** Only include issues updated on/after this date (ISO). Optional. */
  updatedSince?: string;
  maxResults?: number;
}

/**
 * Fetches issues for the configured project via JQL and normalizes them.
 */
export async function fetchProjectIssues(
  config: JiraConnectionConfig,
  apiToken: string,
  options: FetchIssuesOptions = {},
): Promise<NormalizedIssue[]> {
  const domain = normalizeDomain(config.domain);
  const maxResults = Math.min(options.maxResults ?? 100, 100);

  // Resolve the correct API base (instance for classic tokens, gateway for
  // scoped tokens). Browse URLs on issues still use the instance domain.
  const { base } = await resolveApiBase(domain, config.email, apiToken);

  const clauses = [`project = "${config.projectKey}"`];
  if (options.updatedSince) {
    // Jira JQL accepts yyyy-MM-dd.
    const day = options.updatedSince.slice(0, 10);
    clauses.push(`updated >= "${day}"`);
  }
  const jql = `${clauses.join(" AND ")} ORDER BY updated DESC`;

  const res = await jiraFetch(
    base,
    "/rest/api/3/search",
    config.email,
    apiToken,
    {
      method: "POST",
      body: JSON.stringify({
        jql,
        fields: JIRA_FIELDS,
        maxResults,
      }),
    },
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Jira devolvió estado ${res.status} al buscar issues. ${detail.slice(0, 200)}`,
    );
  }

  const data = (await res.json()) as { issues?: RawJiraIssue[] };
  const now = new Date();
  return (data.issues ?? []).map((raw) => normalizeIssue(raw, domain, now));
}
