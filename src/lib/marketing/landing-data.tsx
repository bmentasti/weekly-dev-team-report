// Datos de la landing separados del markup (H12). Contenido bilingüe ES/EN:
// getLandingData(locale) devuelve las series ya traducidas. El render vive en
// src/app/page.tsx. Los nombres de marca (INTEGRATIONS) no se traducen.
import {
  Zap,
  ShieldCheck,
  GaugeCircle,
  Users,
  GitPullRequest,
  PlugZap,
  Layers,
  FileBarChart2,
  ShieldAlert,
  Lock,
  UserCog,
  Boxes,
  ClipboardList,
  Sparkles,
} from "lucide-react";
import type { Locale } from "@/lib/i18n/config";

export const INTEGRATIONS = [
  "Jira",
  "GitHub",
  "GitLab",
  "Bitbucket",
  "Azure DevOps",
  "Slack",
  "Teams",
  "Linear",
  "ClickUp",
  "Notion",
  "Airtable",
  "CI/CD",
];

type Tone = "success" | "info" | "warning" | "destructive";
type Dir = "up" | "down" | "flat";

interface LandingData {
  PROBLEMS: { icon: typeof Boxes; title: string; body: string }[];
  STEPS: { icon: typeof Boxes; n: string; title: string; body: string; micro: string }[];
  REPORT_SHOWCASE: {
    tag: string;
    title: string;
    badge: { label: string; tone: Tone };
    lines: string[];
    cta: string;
  }[];
  METRIC_GROUPS: { icon: typeof Boxes; title: string; items: string[] }[];
  ALERTS: { tone: Tone; label: string; text: string; who: string; action: string }[];
  COMPARE_ROWS: { label: string; s1: string; s2: string; dir: Dir; delta: string }[];
  PIPELINE: string[];
  USE_CASES: { ctx: string; report: string; decision: string; role: string }[];
  TRUST: { icon: typeof Boxes; title: string; body: string }[];
}

const ES: LandingData = {
  PROBLEMS: [
    { icon: Boxes, title: "Datos dispersos", body: "Jira, GitHub, Slack y Figma viven separados. Nadie tiene una foto consolidada del sprint." },
    { icon: ClipboardList, title: "Reportes manuales", body: "Cada semana alguien copia tickets, PRs y gráficos a mano para armar un estado que envejece en horas." },
    { icon: ShieldAlert, title: "Riesgos invisibles", body: "Bloqueos, scope creep y PRs sin review aparecen tarde, cuando ya impactaron la entrega." },
    { icon: GaugeCircle, title: "Poca claridad ejecutiva", body: "Dirección pide estado, pero el equipo no tiene una vista lista para leer sin traducir métricas." },
  ],
  STEPS: [
    { icon: PlugZap, n: "1", title: "Conectá tus herramientas", body: "Vinculá Jira, GitHub, GitLab, Slack y más en vivo. Solo lectura, sin exportar planillas.", micro: "Toma minutos · no toca tus datos" },
    { icon: FileBarChart2, n: "2", title: "Elegí el tipo de reporte", body: "Sprint actual, comparativa, riesgos, calidad técnica o ejecutivo. Vos elegís el período.", micro: "Un proyecto, un período, un click" },
    { icon: Sparkles, n: "3", title: "Obtené insights accionables", body: "Métricas, riesgos y recomendaciones listas para revisar, compartir o exportar.", micro: "De “qué pasó” a “qué hago”" },
  ],
  REPORT_SHOWCASE: [
    { tag: "Reporte de sprint", title: "Frontend · Sprint 24", badge: { label: "Saludable", tone: "success" }, lines: ["Avance 82% · 14 finalizadas", "8 PRs mergeados · cycle 2.1d"], cta: "Ver reporte" },
    { tag: "Comparativa", title: "Sprint 23 → Sprint 24", badge: { label: "Mejora", tone: "info" }, lines: ["Velocity +12% · Bugs −30%", "Scope creep estable"], cta: "Comparar sprints" },
    { tag: "Alto riesgo", title: "Checkout · Sprint 12", badge: { label: "Crítico", tone: "destructive" }, lines: ["5 bloqueadas sin dueño", "Carry over x2 · CI en rojo"], cta: "Ver reporte de riesgo" },
    { tag: "Ejecutivo", title: "Portafolio · Julio", badge: { label: "3 en riesgo", tone: "warning" }, lines: ["9 proyectos · salud 74/100", "Previsibilidad 88%"], cta: "Exportar PDF" },
    { tag: "Calidad técnica", title: "Core API · Sprint 24", badge: { label: "Observación", tone: "warning" }, lines: ["Review time 9h · 4 PRs viejos", "Build failures 2 · coverage 71%"], cta: "Ver reporte" },
    { tag: "Performance del equipo", title: "Equipo Mobile · Sprint 24", badge: { label: "Estable", tone: "info" }, lines: ["Carga equilibrada · 5 activos", "1 persona a acompañar"], cta: "Ver reporte" },
  ],
  METRIC_GROUPS: [
    { icon: Zap, title: "Delivery", items: ["Completion rate", "Velocity", "Throughput", "Lead / cycle time", "Work in progress", "Bloqueadas y arrastradas"] },
    { icon: GitPullRequest, title: "Calidad técnica", items: ["PRs abiertos / mergeados", "Tiempo de review", "Bugs", "Test coverage", "Build / deploy failures", "Incidentes"] },
    { icon: Layers, title: "Producto", items: ["Scope creep", "Historias completadas", "Historias reabiertas", "Listo para demo / prod", "Valor entregado", "Cambios de prioridad"] },
    { icon: Users, title: "Equipo", items: ["Participación", "Comunicación de bloqueos", "Distribución de carga", "Personas destacadas", "A quién acompañar", "Alertas recurrentes"] },
  ],
  ALERTS: [
    { tone: "destructive", label: "Crítico", text: "El sprint tiene alto riesgo de no completarse.", who: "TL · Dirección", action: "Repriorizar alcance" },
    { tone: "warning", label: "Alto", text: "Aumentaron los PRs abiertos sin review.", who: "Tech Lead", action: "Repartir reviews" },
    { tone: "warning", label: "Alto", text: "El scope creep creció respecto al sprint anterior.", who: "Product Owner", action: "Proteger el compromiso" },
    { tone: "warning", label: "Medio", text: "Hay tareas bloqueadas sin responsable.", who: "TL · Scrum", action: "Asignar dueño" },
    { tone: "info", label: "Recurrente", text: "El equipo arrastra tareas por 2º sprint consecutivo.", who: "PO · Scrum", action: "Ajustar planning" },
  ],
  COMPARE_ROWS: [
    { label: "Velocity", s1: "32 pts", s2: "36 pts", dir: "up", delta: "+12%" },
    { label: "Completion rate", s1: "74%", s2: "82%", dir: "up", delta: "+8pp" },
    { label: "Bugs", s1: "10", s2: "7", dir: "up", delta: "−30%" },
    { label: "Review time", s1: "6h", s2: "9h", dir: "down", delta: "+50%" },
    { label: "Scope creep", s1: "14%", s2: "13%", dir: "flat", delta: "≈" },
  ],
  PIPELINE: ["Conectando datos", "Analizando el sprint", "Generando insights", "Reporte listo"],
  USE_CASES: [
    { ctx: "Antes de una daily", report: "Reporte de sprint", decision: "Enfocar la daily en bloqueos y PRs demorados.", role: "Tech Lead" },
    { ctx: "Antes de una demo", report: "Avance funcional", decision: "Mostrar lo entregado sin rearmar la lista a mano.", role: "Product Owner" },
    { ctx: "Reunión con dirección", report: "Reporte ejecutivo", decision: "Comunicar salud, riesgos y tendencia del portafolio.", role: "Director" },
    { ctx: "Cerrar un sprint", report: "Comparativa de sprints", decision: "Detectar qué mejoró, qué empeoró y qué se repite.", role: "TL · PO" },
    { ctx: "Detectar riesgos técnicos", report: "Calidad técnica", decision: "Actuar sobre review lento, bugs y CI inestable.", role: "Tech Lead" },
    { ctx: "Preparar una retro", report: "Comparativa + performance", decision: "Basar la conversación en datos, no percepciones.", role: "Scrum Master" },
  ],
  TRUST: [
    { icon: Lock, title: "Solo lectura y encriptado", body: "Los tokens se guardan encriptados (AES-256-GCM) y nunca se exponen al navegador. Nunca escribimos en tus herramientas." },
    { icon: UserCog, title: "Acceso por rol", body: "Cada persona ve solo los proyectos y reportes que le corresponden. Las lecturas sensibles quedan por permiso." },
    { icon: ShieldCheck, title: "No reemplaza tus tools", body: "Jira, GitHub y Slack siguen igual. DevMetrics los conecta y los transforma en información para decidir." },
    { icon: Sparkles, title: "Vos decidís, no la IA", body: "Los insights se basan en los datos conectados y son sugerencias. La decisión final siempre es tuya." },
  ],
};

const EN: LandingData = {
  PROBLEMS: [
    { icon: Boxes, title: "Scattered data", body: "Jira, GitHub, Slack and Figma live apart. Nobody has a consolidated picture of the sprint." },
    { icon: ClipboardList, title: "Manual reports", body: "Every week someone copies tickets, PRs and charts by hand to build a status that ages in hours." },
    { icon: ShieldAlert, title: "Invisible risks", body: "Blockers, scope creep and PRs without review show up late, once they've already hit delivery." },
    { icon: GaugeCircle, title: "Little executive clarity", body: "Leadership asks for status, but the team has no view ready to read without translating metrics." },
  ],
  STEPS: [
    { icon: PlugZap, n: "1", title: "Connect your tools", body: "Link Jira, GitHub, GitLab, Slack and more, live. Read-only, no spreadsheet exports.", micro: "Takes minutes · doesn't touch your data" },
    { icon: FileBarChart2, n: "2", title: "Pick the report type", body: "Current sprint, comparison, risks, technical quality or executive. You choose the period.", micro: "One project, one period, one click" },
    { icon: Sparkles, n: "3", title: "Get actionable insights", body: "Metrics, risks and recommendations ready to review, share or export.", micro: "From “what happened” to “what do I do”" },
  ],
  REPORT_SHOWCASE: [
    { tag: "Sprint report", title: "Frontend · Sprint 24", badge: { label: "Healthy", tone: "success" }, lines: ["82% progress · 14 done", "8 PRs merged · cycle 2.1d"], cta: "View report" },
    { tag: "Comparison", title: "Sprint 23 → Sprint 24", badge: { label: "Improving", tone: "info" }, lines: ["Velocity +12% · Bugs −30%", "Scope creep stable"], cta: "Compare sprints" },
    { tag: "High risk", title: "Checkout · Sprint 12", badge: { label: "Critical", tone: "destructive" }, lines: ["5 blocked with no owner", "Carry over x2 · CI red"], cta: "View risk report" },
    { tag: "Executive", title: "Portfolio · July", badge: { label: "3 at risk", tone: "warning" }, lines: ["9 projects · health 74/100", "Predictability 88%"], cta: "Export PDF" },
    { tag: "Technical quality", title: "Core API · Sprint 24", badge: { label: "Watch", tone: "warning" }, lines: ["Review time 9h · 4 old PRs", "Build failures 2 · coverage 71%"], cta: "View report" },
    { tag: "Team performance", title: "Mobile team · Sprint 24", badge: { label: "Stable", tone: "info" }, lines: ["Balanced load · 5 active", "1 person to support"], cta: "View report" },
  ],
  METRIC_GROUPS: [
    { icon: Zap, title: "Delivery", items: ["Completion rate", "Velocity", "Throughput", "Lead / cycle time", "Work in progress", "Blocked and carried over"] },
    { icon: GitPullRequest, title: "Technical quality", items: ["Open / merged PRs", "Review time", "Bugs", "Test coverage", "Build / deploy failures", "Incidents"] },
    { icon: Layers, title: "Product", items: ["Scope creep", "Completed stories", "Reopened stories", "Ready for demo / prod", "Value delivered", "Priority changes"] },
    { icon: Users, title: "Team", items: ["Participation", "Blocker communication", "Load distribution", "Standout contributors", "Who to support", "Recurring alerts"] },
  ],
  ALERTS: [
    { tone: "destructive", label: "Critical", text: "The sprint is at high risk of not completing.", who: "TL · Leadership", action: "Re-prioritize scope" },
    { tone: "warning", label: "High", text: "Open PRs without review increased.", who: "Tech Lead", action: "Share out reviews" },
    { tone: "warning", label: "High", text: "Scope creep grew versus the previous sprint.", who: "Product Owner", action: "Protect the commitment" },
    { tone: "warning", label: "Medium", text: "There are blocked tasks with no owner.", who: "TL · Scrum", action: "Assign an owner" },
    { tone: "info", label: "Recurring", text: "The team is carrying over tasks for a 2nd sprint in a row.", who: "PO · Scrum", action: "Adjust planning" },
  ],
  COMPARE_ROWS: [
    { label: "Velocity", s1: "32 pts", s2: "36 pts", dir: "up", delta: "+12%" },
    { label: "Completion rate", s1: "74%", s2: "82%", dir: "up", delta: "+8pp" },
    { label: "Bugs", s1: "10", s2: "7", dir: "up", delta: "−30%" },
    { label: "Review time", s1: "6h", s2: "9h", dir: "down", delta: "+50%" },
    { label: "Scope creep", s1: "14%", s2: "13%", dir: "flat", delta: "≈" },
  ],
  PIPELINE: ["Connecting data", "Analyzing the sprint", "Generating insights", "Report ready"],
  USE_CASES: [
    { ctx: "Before a daily", report: "Sprint report", decision: "Focus the daily on blockers and delayed PRs.", role: "Tech Lead" },
    { ctx: "Before a demo", report: "Functional progress", decision: "Show what's delivered without rebuilding the list by hand.", role: "Product Owner" },
    { ctx: "Leadership meeting", report: "Executive report", decision: "Communicate health, risks and portfolio trend.", role: "Director" },
    { ctx: "Closing a sprint", report: "Sprint comparison", decision: "Detect what improved, what worsened and what repeats.", role: "TL · PO" },
    { ctx: "Spot technical risks", report: "Technical quality", decision: "Act on slow reviews, bugs and unstable CI.", role: "Tech Lead" },
    { ctx: "Prepare a retro", report: "Comparison + performance", decision: "Base the conversation on data, not perceptions.", role: "Scrum Master" },
  ],
  TRUST: [
    { icon: Lock, title: "Read-only and encrypted", body: "Tokens are stored encrypted (AES-256-GCM) and never exposed to the browser. We never write to your tools." },
    { icon: UserCog, title: "Role-based access", body: "Each person only sees the projects and reports that apply to them. Sensitive reads require permission." },
    { icon: ShieldCheck, title: "Doesn't replace your tools", body: "Jira, GitHub and Slack stay the same. DevMetrics connects them and turns them into information to decide." },
    { icon: Sparkles, title: "You decide, not the AI", body: "Insights are based on connected data and are suggestions. The final decision is always yours." },
  ],
};

export function getLandingData(locale: Locale): LandingData {
  return locale === "en" ? EN : ES;
}
