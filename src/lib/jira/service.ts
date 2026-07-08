import { normalizeIssue } from "./classify";
import type {
  JiraConnectionConfig,
  NormalizedIssue,
  RawJiraIssue,
} from "./types";

// JiraIntegrationService — thin server-side client for Jira Cloud REST v3.
// Authenticates with Basic auth (email + API token). Never called from the
// browser; tokens live encrypted in the DB and are decrypted only here.

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

async function jiraFetch(
  domain: string,
  path: string,
  email: string,
  apiToken: string,
  init?: RequestInit,
): Promise<Response> {
  const url = `https://${domain}${path}`;
  return fetch(url, {
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
    // 1. Auth check.
    const meRes = await jiraFetch(
      domain,
      "/rest/api/3/myself",
      config.email,
      apiToken,
    );
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
      domain,
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

  const clauses = [`project = "${config.projectKey}"`];
  if (options.updatedSince) {
    // Jira JQL accepts yyyy-MM-dd.
    const day = options.updatedSince.slice(0, 10);
    clauses.push(`updated >= "${day}"`);
  }
  const jql = `${clauses.join(" AND ")} ORDER BY updated DESC`;

  const res = await jiraFetch(
    domain,
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
