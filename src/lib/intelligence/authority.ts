// Matriz de autoridad de fuentes (Etapa 2).
// Define qué fuente "manda" para cada tipo de dato. Tiene defaults y admite
// overrides por organización. Se aplica automáticamente al resolver conflictos.

export type DataType =
  | "task_status"
  | "code"
  | "quality"
  | "coverage"
  | "deployment"
  | "incidents"
  | "communication"
  | "costs"
  | "capacity";

export interface AuthorityRule {
  primary: string[]; // slugs de fuentes principales (orden = prioridad)
  secondary: string[];
}

/** Defaults del sistema. Los slugs siguen el catálogo de integraciones. */
export const DEFAULT_AUTHORITY: Record<DataType, AuthorityRule> = {
  task_status: {
    primary: [
      "jira",
      "azure-boards",
      "linear",
      "clickup",
      "asana",
      "monday",
      "trello",
      "shortcut",
      "ms-planner",
      "basecamp",
      "teamwork",
      "zoho-projects",
    ],
    secondary: ["github", "gitlab", "bitbucket", "slack", "teams"],
  },
  code: {
    primary: ["github", "gitlab", "bitbucket", "azure-devops"],
    secondary: [],
  },
  quality: {
    primary: ["sonarqube", "sonarcloud", "code-climate", "codacy"],
    secondary: ["eslint", "github"],
  },
  coverage: {
    primary: ["codecov", "coveralls", "vitest", "jest", "cypress", "playwright"],
    secondary: [],
  },
  deployment: {
    primary: [
      "github-actions",
      "gitlab-ci",
      "jenkins",
      "azure-pipelines",
      "argocd",
      "vercel",
      "aws",
    ],
    secondary: ["github", "gitlab"],
  },
  incidents: {
    primary: ["pagerduty", "opsgenie", "incident-io", "servicenow", "sentry"],
    secondary: ["slack", "datadog"],
  },
  communication: {
    primary: ["slack", "teams", "google-chat"],
    secondary: [],
  },
  costs: {
    primary: ["aws-cost-explorer", "azure-cost", "gcp-billing", "vercel"],
    secondary: [],
  },
  capacity: {
    primary: ["google-calendar", "outlook-calendar", "hr", "time-tracking"],
    secondary: ["jira", "teamwork", "zoho-projects"],
  },
};

export type AuthorityOverrides = Partial<Record<DataType, Partial<AuthorityRule>>>;

/** Combina defaults con overrides de una organización. */
export function resolveAuthorityRule(
  dataType: DataType,
  overrides?: AuthorityOverrides,
): AuthorityRule {
  const base = DEFAULT_AUTHORITY[dataType];
  const ov = overrides?.[dataType];
  return {
    primary: ov?.primary ?? base.primary,
    secondary: ov?.secondary ?? base.secondary,
  };
}

/**
 * Dado un tipo de dato y las fuentes presentes, devuelve la de mayor autoridad
 * (primera principal presente; si no, primera secundaria). null si ninguna.
 */
export function resolveAuthority(
  dataType: DataType,
  presentSlugs: string[],
  overrides?: AuthorityOverrides,
): string | null {
  const present = new Set(presentSlugs);
  const rule = resolveAuthorityRule(dataType, overrides);
  for (const slug of rule.primary) if (present.has(slug)) return slug;
  for (const slug of rule.secondary) if (present.has(slug)) return slug;
  return null;
}

/** ¿La fuente es principal para el tipo de dato? */
export function isPrimarySource(
  dataType: DataType,
  slug: string,
  overrides?: AuthorityOverrides,
): boolean {
  return resolveAuthorityRule(dataType, overrides).primary.includes(slug);
}
