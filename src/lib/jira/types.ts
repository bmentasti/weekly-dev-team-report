// Domain types for Jira issues, normalized away from the raw Jira REST shape.

export type IssueBucket =
  | "DONE"
  | "IN_PROGRESS"
  | "TODO"
  | "BLOCKED";

export interface NormalizedIssue {
  key: string;
  summary: string;
  status: string;
  statusCategory: "new" | "indeterminate" | "done" | "unknown";
  assignee: string | null;
  priority: string | null;
  issueType: string | null;
  labels: string[];
  storyPoints: number | null;
  sprint: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  resolvedAt: string | null;
  url: string;
  // Derived flags (see classify.ts)
  bucket: IssueBucket;
  isBlocked: boolean;
  isCritical: boolean;
  isStale: boolean;
  /**
   * Responsable al momento de resolverse (del changelog). Para tareas DONE es
   * quien hay que atribuir, NO el assignee actual si cambió después (§5).
   * Ausente si no hay changelog o la tarea no está resuelta.
   */
  assigneeAtResolution?: string | null;
  /** ¿La tarea fue reasignada alguna vez (según changelog)? */
  reassigned?: boolean;
}

export interface JiraConnectionConfig {
  domain: string; // e.g. empresa.atlassian.net
  email: string;
  projectKey: string;
}

// Raw Jira REST v3 issue shape (only the fields we read).
export interface RawJiraIssue {
  key: string;
  fields: {
    summary?: string;
    status?: {
      name?: string;
      statusCategory?: { key?: string };
    };
    assignee?: { displayName?: string } | null;
    priority?: { name?: string } | null;
    issuetype?: { name?: string } | null;
    labels?: string[];
    created?: string;
    updated?: string;
    resolutiondate?: string | null;
    [key: string]: unknown; // custom fields (story points, sprint)
  };
  /** Presente cuando la búsqueda pide expand=changelog. */
  changelog?: {
    histories?: {
      created?: string;
      items?: { field?: string; fromString?: string | null; toString?: string | null }[];
    }[];
  };
}
