// Capabilities por integración (Etapa 1).
// Cada herramienta declara SOLO lo que realmente aporta. Esto permite saber
// qué dimensiones puede analizar DevMetrics según lo conectado.

export type Capability =
  | "project_management"
  | "portfolio_management"
  | "source_control"
  | "pull_requests"
  | "code_quality"
  | "testing"
  | "coverage"
  | "ci_cd"
  | "deployments"
  | "observability"
  | "incidents"
  | "communication"
  | "documentation"
  | "design"
  | "capacity"
  | "time_tracking"
  | "costs"
  | "security"
  | "customer_support"
  | "hr"
  | "ai_usage";

/**
 * Capabilities reales de cada provider hoy conectable en DevMetrics.
 * Se mapea por slug. Providers no listados se tratan como sin capabilities
 * (no aportan a ninguna dimensión).
 */
export const PROVIDER_CAPABILITIES: Record<string, Capability[]> = {
  // Gestión de tareas
  jira: ["project_management"],
  linear: ["project_management"],
  clickup: ["project_management"],
  airtable: ["project_management"],
  trello: ["project_management"],
  shortcut: ["project_management"],
  "azure-boards": ["project_management"],
  "ms-planner": ["project_management"],
  basecamp: ["project_management"],
  teamwork: ["project_management", "time_tracking"],
  "zoho-projects": ["project_management", "time_tracking"],
  // Planificación / portfolio
  monday: ["project_management", "portfolio_management"],
  asana: ["project_management", "portfolio_management"],
  smartsheet: ["project_management", "portfolio_management"],
  wrike: ["project_management", "portfolio_management"],
  "ms-project": ["portfolio_management", "project_management"],
  primavera: ["portfolio_management"],
  "jira-align": ["portfolio_management"],
  "jira-roadmaps": ["portfolio_management"],
  // Código
  github: ["source_control", "pull_requests", "ci_cd"],
  gitlab: ["source_control", "pull_requests", "ci_cd"],
  bitbucket: ["source_control", "pull_requests"],
  "azure-devops": ["source_control", "pull_requests", "ci_cd"],
  // Comunicación
  slack: ["communication"],
  teams: ["communication"],
  discord: ["communication"],
  // Documentación
  notion: ["documentation", "project_management"],
  // IA
  openai: ["ai_usage"],
  anthropic: ["ai_usage"],
  gemini: ["ai_usage"],
  copilot: ["ai_usage"],
};

/** Devuelve el conjunto de capabilities aportadas por una lista de slugs. */
export function capabilitiesForSlugs(slugs: string[]): Set<Capability> {
  const out = new Set<Capability>();
  for (const slug of slugs) {
    for (const cap of PROVIDER_CAPABILITIES[slug] ?? []) out.add(cap);
  }
  return out;
}

/** ¿El provider aporta esta capability? */
export function providerHasCapability(slug: string, cap: Capability): boolean {
  return (PROVIDER_CAPABILITIES[slug] ?? []).includes(cap);
}
