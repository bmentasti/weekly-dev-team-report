// Datos de la landing separados del markup (H12). Solo contenido; el render
// vive en src/app/page.tsx.
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

export const PROBLEMS = [
  {
    icon: Boxes,
    title: "Datos dispersos",
    body: "Jira, GitHub, Slack y Figma viven separados. Nadie tiene una foto consolidada del sprint.",
  },
  {
    icon: ClipboardList,
    title: "Reportes manuales",
    body: "Cada semana alguien copia tickets, PRs y gráficos a mano para armar un estado que envejece en horas.",
  },
  {
    icon: ShieldAlert,
    title: "Riesgos invisibles",
    body: "Bloqueos, scope creep y PRs sin review aparecen tarde, cuando ya impactaron la entrega.",
  },
  {
    icon: GaugeCircle,
    title: "Poca claridad ejecutiva",
    body: "Dirección pide estado, pero el equipo no tiene una vista lista para leer sin traducir métricas.",
  },
];

export const STEPS = [
  {
    icon: PlugZap,
    n: "1",
    title: "Conectá tus herramientas",
    body: "Vinculá Jira, GitHub, GitLab, Slack y más en vivo. Solo lectura, sin exportar planillas.",
    micro: "Toma minutos · no toca tus datos",
  },
  {
    icon: FileBarChart2,
    n: "2",
    title: "Elegí el tipo de reporte",
    body: "Sprint actual, comparativa, riesgos, calidad técnica o ejecutivo. Vos elegís el período.",
    micro: "Un proyecto, un período, un click",
  },
  {
    icon: Sparkles,
    n: "3",
    title: "Obtené insights accionables",
    body: "Métricas, riesgos y recomendaciones listas para revisar, compartir o exportar.",
    micro: "De “qué pasó” a “qué hago”",
  },
];

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

export const REPORT_SHOWCASE = [
  {
    tag: "Reporte de sprint",
    title: "Frontend · Sprint 24",
    badge: { label: "Saludable", tone: "success" as const },
    lines: ["Avance 82% · 14 finalizadas", "8 PRs mergeados · cycle 2.1d"],
    cta: "View report",
  },
  {
    tag: "Comparativa",
    title: "Sprint 23 → Sprint 24",
    badge: { label: "Mejora", tone: "info" as const },
    lines: ["Velocity +12% · Bugs −30%", "Scope creep estable"],
    cta: "Compare sprints",
  },
  {
    tag: "Alto riesgo",
    title: "Checkout · Sprint 12",
    badge: { label: "Crítico", tone: "destructive" as const },
    lines: ["5 bloqueadas sin dueño", "Carry over x2 · CI en rojo"],
    cta: "View risk report",
  },
  {
    tag: "Ejecutivo",
    title: "Portafolio · Julio",
    badge: { label: "3 en riesgo", tone: "warning" as const },
    lines: ["9 proyectos · salud 74/100", "Previsibilidad 88%"],
    cta: "Export PDF",
  },
  {
    tag: "Calidad técnica",
    title: "Core API · Sprint 24",
    badge: { label: "Observación", tone: "warning" as const },
    lines: ["Review time 9h · 4 PRs viejos", "Build failures 2 · coverage 71%"],
    cta: "View report",
  },
  {
    tag: "Performance del equipo",
    title: "Equipo Mobile · Sprint 24",
    badge: { label: "Estable", tone: "info" as const },
    lines: ["Carga equilibrada · 5 activos", "1 persona a acompañar"],
    cta: "View report",
  },
];

export const METRIC_GROUPS = [
  {
    icon: Zap,
    title: "Delivery",
    items: [
      "Completion rate",
      "Velocity",
      "Throughput",
      "Lead / cycle time",
      "Work in progress",
      "Bloqueadas y arrastradas",
    ],
  },
  {
    icon: GitPullRequest,
    title: "Calidad técnica",
    items: [
      "PRs abiertos / mergeados",
      "Tiempo de review",
      "Bugs",
      "Test coverage",
      "Build / deploy failures",
      "Incidentes",
    ],
  },
  {
    icon: Layers,
    title: "Producto",
    items: [
      "Scope creep",
      "Historias completadas",
      "Historias reabiertas",
      "Listo para demo / prod",
      "Valor entregado",
      "Cambios de prioridad",
    ],
  },
  {
    icon: Users,
    title: "Equipo",
    items: [
      "Participación",
      "Comunicación de bloqueos",
      "Distribución de carga",
      "Personas destacadas",
      "A quién acompañar",
      "Alertas recurrentes",
    ],
  },
];

export const ALERTS = [
  {
    tone: "destructive" as const,
    label: "Crítico",
    text: "El sprint tiene alto riesgo de no completarse.",
    who: "TL · Dirección",
    action: "Repriorizar alcance",
  },
  {
    tone: "warning" as const,
    label: "Alto",
    text: "Aumentaron los PRs abiertos sin review.",
    who: "Tech Lead",
    action: "Repartir reviews",
  },
  {
    tone: "warning" as const,
    label: "Alto",
    text: "El scope creep creció respecto al sprint anterior.",
    who: "Product Owner",
    action: "Proteger el compromiso",
  },
  {
    tone: "warning" as const,
    label: "Medio",
    text: "Hay tareas bloqueadas sin responsable.",
    who: "TL · Scrum",
    action: "Asignar dueño",
  },
  {
    tone: "info" as const,
    label: "Recurrente",
    text: "El equipo arrastra tareas por 2º sprint consecutivo.",
    who: "PO · Scrum",
    action: "Ajustar planning",
  },
];

export const COMPARE_ROWS = [
  { label: "Velocity", s1: "32 pts", s2: "36 pts", dir: "up" as const, delta: "+12%" },
  { label: "Completion rate", s1: "74%", s2: "82%", dir: "up" as const, delta: "+8pp" },
  { label: "Bugs", s1: "10", s2: "7", dir: "up" as const, delta: "−30%" },
  { label: "Review time", s1: "6h", s2: "9h", dir: "down" as const, delta: "+50%" },
  { label: "Scope creep", s1: "14%", s2: "13%", dir: "flat" as const, delta: "≈" },
];

export const PIPELINE = [
  "Conectando datos",
  "Analizando el sprint",
  "Generando insights",
  "Reporte listo",
];

export const USE_CASES = [
  {
    ctx: "Antes de una daily",
    report: "Reporte de sprint",
    decision: "Enfocar la daily en bloqueos y PRs demorados.",
    role: "Tech Lead",
  },
  {
    ctx: "Antes de una demo",
    report: "Avance funcional",
    decision: "Mostrar lo entregado sin rearmar la lista a mano.",
    role: "Product Owner",
  },
  {
    ctx: "Reunión con dirección",
    report: "Reporte ejecutivo",
    decision: "Comunicar salud, riesgos y tendencia del portafolio.",
    role: "Director",
  },
  {
    ctx: "Cerrar un sprint",
    report: "Comparativa de sprints",
    decision: "Detectar qué mejoró, qué empeoró y qué se repite.",
    role: "TL · PO",
  },
  {
    ctx: "Detectar riesgos técnicos",
    report: "Calidad técnica",
    decision: "Actuar sobre review lento, bugs y CI inestable.",
    role: "Tech Lead",
  },
  {
    ctx: "Preparar una retro",
    report: "Comparativa + performance",
    decision: "Basar la conversación en datos, no percepciones.",
    role: "Scrum Master",
  },
];

export const TRUST = [
  {
    icon: Lock,
    title: "Solo lectura y encriptado",
    body: "Los tokens se guardan encriptados (AES-256-GCM) y nunca se exponen al navegador. Nunca escribimos en tus herramientas.",
  },
  {
    icon: UserCog,
    title: "Acceso por rol",
    body: "Cada persona ve solo los proyectos y reportes que le corresponden. Las lecturas sensibles quedan por permiso.",
  },
  {
    icon: ShieldCheck,
    title: "No reemplaza tus tools",
    body: "Jira, GitHub y Slack siguen igual. DevMetrics los conecta y los transforma en información para decidir.",
  },
  {
    icon: Sparkles,
    title: "Vos decidís, no la IA",
    body: "Los insights se basan en los datos conectados y son sugerencias. La decisión final siempre es tuya.",
  },
];
