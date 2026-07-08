import type { ProviderSlug } from "./catalog";
import type {
  ActivitySignal,
  CiRun,
  ProviderData,
  UnifiedCodeChange,
  UnifiedWorkItem,
} from "./types";

function demoCiRuns(source: "github" | "gitlab"): CiRun[] {
  const mk = (n: number, status: CiRun["status"], name: string, isDeploy = false): CiRun => ({
    source,
    externalId: `${n}`,
    name,
    status,
    isDeploy,
    url: "#",
    createdAt: iso(n * 60 * 60 * 1000),
  });
  return [
    mk(2, "success", "CI · build & test"),
    mk(6, "success", "CI · build & test"),
    mk(10, "failure", "CI · build & test"),
    mk(14, "success", "Deploy staging", true),
    mk(20, "failure", "Deploy production", true),
    mk(26, "success", "CI · build & test"),
    mk(30, "running", "CI · build & test"),
  ];
}

// Demo dataset. When an integration is configured with { demo: "true" }, its
// adapter returns this canned data instead of calling the real API. Lets you
// explore the product and generate a full report without real credentials.

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();

function jiraWorkItems(): UnifiedWorkItem[] {
  const base = (o: Partial<UnifiedWorkItem>): UnifiedWorkItem => ({
    source: "jira",
    externalId: "FOR-0",
    title: "",
    status: "To Do",
    bucket: "TODO",
    assignee: null,
    priority: "Medium",
    isCritical: false,
    isStale: false,
    storyPoints: null,
    labels: [],
    type: "Task",
    project: "FOR",
    sprint: "Sprint 12",
    url: "https://demo.atlassian.net/browse/FOR-0",
    createdAt: iso(20 * DAY),
    updatedAt: iso(1 * DAY),
    resolvedAt: null,
    ...o,
  });
  return [
    // Ana — alto aporte (varias finalizadas, sin bloqueos)
    base({ externalId: "FOR-123", title: "Implementar login", status: "Done", bucket: "DONE", assignee: "Ana", storyPoints: 5, createdAt: iso(9 * DAY), resolvedAt: iso(2 * DAY), updatedAt: iso(2 * DAY) }),
    base({ externalId: "FOR-125", title: "Corregir bug de filtros", type: "Bug", status: "Done", bucket: "DONE", assignee: "Ana", storyPoints: 2, createdAt: iso(7 * DAY), resolvedAt: iso(3 * DAY), updatedAt: iso(3 * DAY) }),
    base({ externalId: "FOR-126", title: "Validación de formularios", status: "Done", bucket: "DONE", assignee: "Ana", storyPoints: 3, createdAt: iso(6 * DAY), resolvedAt: iso(1 * DAY), updatedAt: iso(1 * DAY) }),
    base({ externalId: "FOR-133", title: "Mejorar accesibilidad", status: "In Progress", bucket: "IN_PROGRESS", assignee: "Ana", storyPoints: 3, updatedAt: iso(1 * DAY) }),
    // Bruno — sobrecargado (mucho WIP) + una crítica sin movimiento
    base({ externalId: "FOR-124", title: "Ajustar dashboard", status: "Done", bucket: "DONE", assignee: "Bruno", storyPoints: 3, createdAt: iso(6 * DAY), resolvedAt: iso(1 * DAY), updatedAt: iso(1 * DAY) }),
    base({ externalId: "FOR-130", title: "Integración con pagos", status: "In Progress", bucket: "IN_PROGRESS", assignee: "Bruno", priority: "High", isCritical: true, isStale: true, storyPoints: 8, updatedAt: iso(6 * DAY) }),
    base({ externalId: "FOR-142", title: "Bug: filtros rompen en Safari", type: "Bug", status: "In Progress", bucket: "IN_PROGRESS", assignee: "Bruno", isStale: true, storyPoints: 3, updatedAt: iso(7 * DAY) }),
    base({ externalId: "FOR-160", title: "Ajuste urgente pedido a mitad de sprint", status: "In Progress", bucket: "IN_PROGRESS", assignee: "Ana", storyPoints: 3, createdAt: iso(1 * DAY), updatedAt: iso(1 * DAY) }),
    base({ externalId: "FOR-143", title: "Cache de reportes", status: "In Progress", bucket: "IN_PROGRESS", assignee: "Bruno", storyPoints: 5, updatedAt: iso(1 * DAY) }),
    base({ externalId: "FOR-144", title: "Rate limiting API", status: "In Progress", bucket: "IN_PROGRESS", assignee: "Bruno", storyPoints: 3, updatedAt: iso(2 * DAY) }),
    base({ externalId: "FOR-145", title: "Webhooks de pago", status: "In Progress", bucket: "IN_PROGRESS", assignee: "Bruno", storyPoints: 5, updatedAt: iso(1 * DAY) }),
    // Carla — necesita apoyo (bloqueada + crítica en progreso)
    base({ externalId: "FOR-131", title: "Reportes ejecutivos", status: "In Progress", bucket: "IN_PROGRESS", assignee: "Carla", priority: "High", isCritical: true, storyPoints: 5, updatedAt: iso(1 * DAY) }),
    base({ externalId: "FOR-140", title: "Refactor de autenticación", status: "Blocked", bucket: "BLOCKED", assignee: "Carla", labels: ["blocked"], storyPoints: 5, updatedAt: iso(2 * DAY) }),
    base({ externalId: "FOR-146", title: "Integrar SSO", status: "Blocked", bucket: "BLOCKED", assignee: "Carla", labels: ["blocked"], isStale: true, storyPoints: 8, updatedAt: iso(6 * DAY) }),
    // Diego — capacidad libre (poco trabajo)
    base({ externalId: "FOR-127", title: "Actualizar documentación", status: "Done", bucket: "DONE", assignee: "Diego", storyPoints: 1, createdAt: iso(4 * DAY), resolvedAt: iso(2 * DAY), updatedAt: iso(2 * DAY) }),
    // Backlog sin asignar
    base({ externalId: "FOR-141", title: "Migración de base de datos", status: "To Do", bucket: "TODO", storyPoints: 8, updatedAt: iso(4 * DAY) }),
    base({ externalId: "FOR-150", title: "Rediseño onboarding", status: "To Do", bucket: "TODO", storyPoints: 5, updatedAt: iso(3 * DAY) }),
  ];
}

function linearWorkItems(): UnifiedWorkItem[] {
  const base = (o: Partial<UnifiedWorkItem>): UnifiedWorkItem => ({
    source: "linear",
    externalId: "ENG-0",
    title: "",
    status: "Todo",
    bucket: "TODO",
    assignee: null,
    priority: "Medium",
    isCritical: false,
    isStale: false,
    storyPoints: 3,
    labels: [],
    type: null,
    project: "ENG",
    sprint: null,
    url: "https://linear.app/demo/issue/ENG-0",
    createdAt: iso(15 * DAY),
    updatedAt: iso(1 * DAY),
    resolvedAt: null,
    ...o,
  });
  return [
    base({ externalId: "ENG-12", title: "Diseño de la API pública", status: "In Progress", bucket: "IN_PROGRESS", assignee: "Elena", storyPoints: 5, updatedAt: iso(1 * DAY) }),
    base({ externalId: "ENG-15", title: "Bug en notificaciones", status: "Blocked", bucket: "BLOCKED", assignee: "Elena", labels: ["blocked"], priority: "Urgent", isCritical: true, isStale: true, storyPoints: 3, updatedAt: iso(6 * DAY) }),
    base({ externalId: "ENG-9", title: "Setup de CI", status: "Done", bucket: "DONE", assignee: "Diego", storyPoints: 5, createdAt: iso(10 * DAY), resolvedAt: iso(2 * DAY), updatedAt: iso(2 * DAY) }),
    base({ externalId: "ENG-18", title: "Endpoint de métricas", status: "Done", bucket: "DONE", assignee: "Elena", storyPoints: 3, createdAt: iso(8 * DAY), resolvedAt: iso(1 * DAY), updatedAt: iso(1 * DAY) }),
    base({ externalId: "ENG-21", title: "Migrar a nuevo SDK", status: "In Progress", bucket: "IN_PROGRESS", assignee: "Diego", storyPoints: 8, updatedAt: iso(1 * DAY) }),
  ];
}

function githubCodeChanges(): UnifiedCodeChange[] {
  const base = (o: Partial<UnifiedCodeChange>): UnifiedCodeChange => ({
    source: "github",
    externalId: "0",
    title: "",
    author: null,
    state: "OPEN",
    reviewerCount: 1,
    hasReviewer: true,
    checksState: "success",
    draft: false,
    ageHours: 5,
    isOld: false,
    isRisk: false,
    url: "https://github.com/demo/web-app/pull/0",
    createdAt: iso(5 * HOUR),
    updatedAt: iso(2 * HOUR),
    mergedAt: null,
    closedAt: null,
    ...o,
  });
  return [
    base({ externalId: "45", title: "Add login flow", author: "Ana", state: "MERGED", mergedAt: iso(2 * DAY), createdAt: iso(4 * DAY), checksState: "success" }),
    base({ externalId: "46", title: "Fix dashboard layout", author: "Bruno", state: "MERGED", mergedAt: iso(1 * DAY), createdAt: iso(3 * DAY) }),
    base({ externalId: "50", title: "Add form validation", author: "Ana", state: "MERGED", mergedAt: iso(1 * DAY), createdAt: iso(2 * DAY) }),
    base({ externalId: "51", title: "Improve a11y on modals", author: "Ana", state: "MERGED", mergedAt: iso(6 * HOUR), createdAt: iso(1 * DAY) }),
    base({ externalId: "47", title: "Add Jira integration", author: "Bruno", state: "OPEN", ageHours: 96, isOld: true, isRisk: true, createdAt: iso(4 * DAY), reviewerCount: 1, hasReviewer: true }),
    base({ externalId: "48", title: "Refactor report service", author: "Carla", state: "OPEN", ageHours: 120, isOld: true, isRisk: true, createdAt: iso(5 * DAY), reviewerCount: 0, hasReviewer: false, checksState: "failure" }),
    base({ externalId: "52", title: "Payment webhooks", author: "Bruno", state: "OPEN", ageHours: 30, createdAt: iso(30 * HOUR), reviewerCount: 0, hasReviewer: false }),
    base({ externalId: "49", title: "Update dependencies", author: "Ana", state: "OPEN", ageHours: 10, createdAt: iso(10 * HOUR) }),
    base({ externalId: "53", title: "Docs: setup guide", author: "Diego", state: "MERGED", mergedAt: iso(2 * DAY), createdAt: iso(3 * DAY) }),
  ];
}

function gitlabCodeChanges(): UnifiedCodeChange[] {
  const base = (o: Partial<UnifiedCodeChange>): UnifiedCodeChange => ({
    source: "gitlab",
    externalId: "0",
    title: "",
    author: null,
    state: "OPEN",
    reviewerCount: 1,
    hasReviewer: true,
    checksState: "success",
    draft: false,
    ageHours: 8,
    isOld: false,
    isRisk: false,
    url: "https://gitlab.com/demo/proyecto/-/merge_requests/0",
    createdAt: iso(8 * HOUR),
    updatedAt: iso(2 * HOUR),
    mergedAt: null,
    closedAt: null,
    ...o,
  });
  return [
    base({ externalId: "12", title: "Add metrics endpoint", author: "Elena", state: "MERGED", mergedAt: iso(1 * DAY), createdAt: iso(3 * DAY) }),
    base({ externalId: "14", title: "Migrate SDK usage", author: "Diego", state: "MERGED", mergedAt: iso(2 * DAY), createdAt: iso(4 * DAY) }),
    base({ externalId: "13", title: "Fix CI pipeline", author: "Carla", state: "OPEN", ageHours: 90, isOld: true, isRisk: true, createdAt: iso(4 * DAY), reviewerCount: 0, hasReviewer: false, checksState: "failure" }),
    base({ externalId: "15", title: "Refactor notifications", author: "Elena", state: "OPEN", ageHours: 20, createdAt: iso(20 * HOUR), reviewerCount: 1, hasReviewer: true }),
  ];
}

function slackActivity(): ActivitySignal[] {
  const base = (o: Partial<ActivitySignal>): ActivitySignal => ({
    source: "slack",
    externalId: "0",
    author: null,
    channel: "equipo-dev",
    text: "",
    isBlocker: false,
    url: null,
    createdAt: iso(2 * HOUR),
    ...o,
  });
  return [
    base({ externalId: "1", author: "Ana", text: "Avanzando con el login, casi listo", createdAt: iso(6 * HOUR) }),
    base({ externalId: "2", author: "Carla", text: "Estoy blocked con el refactor, no puedo avanzar sin el review", isBlocker: true, createdAt: iso(5 * HOUR) }),
    base({ externalId: "3", author: "Bruno", text: "Reviso los PRs abiertos hoy a la tarde", createdAt: iso(4 * HOUR) }),
    base({ externalId: "4", author: "Carla", text: "Sigo trabada con el SSO, esperando acceso al proveedor", isBlocker: true, createdAt: iso(3 * HOUR) }),
    base({ externalId: "5", author: "Elena", text: "El bug de notificaciones está bloqueado por un tema de infra", isBlocker: true, createdAt: iso(2 * HOUR) }),
    base({ externalId: "6", author: "Diego", text: "Terminé la doc, ¿algo más que quieran que tome?", createdAt: iso(2 * HOUR) }),
    base({ externalId: "7", author: "Bruno", text: "Estoy con muchas cosas en paralelo, si alguien puede tomar el rate limiting mejor", createdAt: iso(1 * HOUR) }),
  ];
}

export function isDemo(config: Record<string, string>): boolean {
  return config.demo === "true";
}

export function periodDaysFrom(opts?: { since?: string }): number {
  if (!opts?.since) return 7;
  const d = Math.round(
    (Date.now() - new Date(opts.since).getTime()) / (24 * 60 * 60 * 1000),
  );
  return d > 0 ? d : 7;
}

const PEOPLE = ["Ana", "Bruno", "Carla", "Diego", "Elena"];

// For longer periods we accumulate extra completed history so a 3-month report
// clearly out-scales a single sprint (higher velocity, throughput, trend).
function extraWeeks(periodDays: number): number {
  return Math.max(0, Math.floor(periodDays / 7) - 2);
}

function histWorkItem(
  prefix: string,
  n: number,
  who: string,
  daysAgo: number,
): UnifiedWorkItem {
  return {
    source: "jira",
    externalId: `${prefix}-${n}`,
    title: "Tarea completada (histórico)",
    status: "Done",
    bucket: "DONE",
    assignee: who,
    priority: "Medium",
    isCritical: false,
    isStale: false,
    storyPoints: 3,
    labels: [],
    type: "Task",
    project: prefix,
    sprint: null,
    url: `https://demo.atlassian.net/browse/${prefix}-${n}`,
    createdAt: iso((daysAgo + 3) * DAY),
    updatedAt: iso(daysAgo * DAY),
    resolvedAt: iso(daysAgo * DAY),
  };
}

function histPr(
  source: "github" | "gitlab",
  n: number,
  who: string,
  daysAgo: number,
): UnifiedCodeChange {
  return {
    source,
    externalId: `${900 + n}`,
    title: "Cambio mergeado (histórico)",
    author: who,
    state: "MERGED",
    reviewerCount: 1,
    hasReviewer: true,
    checksState: "success",
    draft: false,
    ageHours: 0,
    isOld: false,
    isRisk: false,
    url: "#",
    createdAt: iso((daysAgo + 2) * DAY),
    updatedAt: iso(daysAgo * DAY),
    mergedAt: iso(daysAgo * DAY),
    closedAt: null,
  };
}

export function demoDataFor(
  slug: ProviderSlug,
  periodDays = 7,
): ProviderData {
  const weeks = extraWeeks(periodDays);

  switch (slug) {
    case "jira": {
      const items = jiraWorkItems();
      for (let w = 0; w < weeks; w++) {
        items.push(histWorkItem("FOR", 200 + w * 2, PEOPLE[w % 4], 15 + w * 7));
        items.push(histWorkItem("FOR", 201 + w * 2, PEOPLE[(w + 1) % 4], 16 + w * 7));
      }
      return { workItems: items };
    }
    case "linear": {
      const items = linearWorkItems();
      for (let w = 0; w < weeks; w++) {
        const it = histWorkItem("ENG", 300 + w, PEOPLE[(w + 3) % 5], 15 + w * 7);
        items.push({ ...it, source: "linear", url: `https://linear.app/demo/issue/ENG-${300 + w}` });
      }
      return { workItems: items };
    }
    case "github": {
      const items = githubCodeChanges();
      for (let w = 0; w < weeks; w++)
        items.push(histPr("github", w, PEOPLE[w % 5], 15 + w * 7));
      return { codeChanges: items, ciRuns: demoCiRuns("github") };
    }
    case "gitlab": {
      const items = gitlabCodeChanges();
      for (let w = 0; w < weeks; w++)
        items.push(histPr("gitlab", 100 + w, PEOPLE[(w + 2) % 5], 16 + w * 7));
      return { codeChanges: items, ciRuns: demoCiRuns("gitlab") };
    }
    case "slack":
      return { activity: slackActivity() };
    default:
      return {};
  }
}
