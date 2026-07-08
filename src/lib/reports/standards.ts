// Parámetros de análisis / Umbrales de salud (Health Standards).
// Define los estándares base recomendados por DevMetrics para evaluar reportes,
// qué métricas son editables y cómo se compone el score de salud.
//
// Free usa siempre los valores base. Team/Pro pueden guardar un estándar
// personalizado (persistido en HealthStandard.config).

import type { ReportMetrics } from "./types";
import { levelOf, type ScoreLevel } from "./score";

export type MetricCategory = "delivery" | "quality" | "product" | "team";
export type MetricRole = "TL" | "PO" | "DIR" | "TODOS";

/** Dirección de la métrica: si un valor más alto es mejor o peor. */
export type MetricDirection = "higherIsBetter" | "lowerIsBetter";

export interface MetricDef {
  key: string;
  label: string;
  category: MetricCategory;
  unit: string; // "%", "h", "d", "" (conteo)
  direction: MetricDirection;
  role: MetricRole;
  help: string;
  action: string; // qué recomienda la app si está fuera de rango
  source?: string; // integración que alimenta la métrica (hint de "sin datos")
  /** Umbrales base recomendados. */
  healthy: number; // límite del rango saludable
  risk: number; // a partir de acá es alto riesgo
  min: number;
  max: number;
  step: number;
}

/**
 * Catálogo curado de métricas editables (MVP). Para cada una, `healthy` y `risk`
 * definen las tres bandas del semáforo por métrica:
 *  - higherIsBetter:  >= healthy = Saludable · entre = Observación · < risk = Alto riesgo
 *  - lowerIsBetter:   <= healthy = Saludable · entre = Observación · > risk = Alto riesgo
 */
export const METRIC_DEFS: MetricDef[] = [
  // Delivery
  {
    key: "completionRate",
    label: "Completion rate mínimo",
    category: "delivery",
    unit: "%",
    direction: "higherIsBetter",
    role: "PO",
    help: "Porcentaje del trabajo comprometido que se completó en el sprint.",
    action: "Revisá capacidad y refinamiento; puede haber sobrecompromiso.",
    healthy: 85,
    risk: 70,
    min: 0,
    max: 100,
    step: 5,
    source: "Jira / tareas",
  },
  {
    key: "commitmentReliability",
    label: "Confiabilidad del compromiso mín.",
    category: "delivery",
    unit: "%",
    direction: "higherIsBetter",
    role: "PO",
    help: "Story points completados sobre los comprometidos: qué tan confiable es lo que el equipo se compromete a entregar.",
    action: "Si es bajo de forma sostenida, ajustá el tamaño del compromiso, no presiones el ritmo.",
    healthy: 85,
    risk: 65,
    min: 0,
    max: 100,
    step: 5,
    source: "Jira (story points)",
  },
  {
    key: "scopeCreep",
    label: "Scope creep máximo",
    category: "delivery",
    unit: "%",
    direction: "lowerIsBetter",
    role: "PO",
    help: "Trabajo agregado después de iniciado el sprint.",
    action: "Protegé el compromiso; revisá cómo entra el trabajo nuevo.",
    healthy: 10,
    risk: 20,
    min: 0,
    max: 60,
    step: 5,
  },
  {
    key: "blocked",
    label: "Tareas bloqueadas máx.",
    category: "delivery",
    unit: "",
    direction: "lowerIsBetter",
    role: "TL",
    help: "Ítems detenidos por una dependencia o impedimento.",
    action: "Atacá los bloqueos en la daily antes de que arrastren el sprint.",
    healthy: 1,
    risk: 4,
    min: 0,
    max: 20,
    step: 1,
  },
  {
    key: "carryOver",
    label: "Tareas arrastradas máx.",
    category: "delivery",
    unit: "",
    direction: "lowerIsBetter",
    role: "PO",
    help: "Tareas que pasan de un sprint al siguiente sin terminarse.",
    action: "Ajustá el tamaño de historias y el planning.",
    healthy: 2,
    risk: 5,
    min: 0,
    max: 20,
    step: 1,
  },
  {
    key: "cycleTime",
    label: "Cycle time esperado",
    category: "delivery",
    unit: "d",
    direction: "lowerIsBetter",
    role: "TL",
    help: "Días desde que se empieza una tarea hasta que se cierra.",
    action: "Revisá tiempos de review y límite de WIP.",
    healthy: 3,
    risk: 6,
    min: 0,
    max: 30,
    step: 1,
  },
  // Calidad técnica
  {
    key: "prOpenAge",
    label: "Antigüedad máx. de PR abierto",
    category: "quality",
    unit: "h",
    direction: "lowerIsBetter",
    role: "TL",
    help: "Horas que un PR puede quedar abierto antes de considerarse viejo.",
    action: "Repartí reviews y achicá PRs.",
    healthy: 24,
    risk: 72,
    min: 0,
    max: 240,
    step: 12,
  },
  {
    key: "reviewTime",
    label: "Tiempo de review máx.",
    category: "quality",
    unit: "h",
    direction: "lowerIsBetter",
    role: "TL",
    help: "Horas promedio desde que se abre un PR hasta que se aprueba.",
    action: "Sumá reviewers o definí SLAs de review.",
    healthy: 8,
    risk: 24,
    min: 0,
    max: 120,
    step: 4,
    source: "GitHub/GitLab (roadmap)",
  },
  {
    key: "bugs",
    label: "Bugs abiertos máx.",
    category: "quality",
    unit: "",
    direction: "lowerIsBetter",
    role: "TL",
    help: "Defectos abiertos en el período.",
    action: "Balanceá features vs. estabilidad; reforzá testing.",
    healthy: 3,
    risk: 8,
    min: 0,
    max: 50,
    step: 1,
  },
  {
    key: "coverage",
    label: "Test coverage mínimo",
    category: "quality",
    unit: "%",
    direction: "higherIsBetter",
    role: "TL",
    help: "Porcentaje de código cubierto por tests (requiere integración de cobertura).",
    action: "Fijá un umbral por repo y no bajes de ahí.",
    healthy: 80,
    risk: 60,
    min: 0,
    max: 100,
    step: 5,
    source: "Cobertura: Codecov/Sonar (roadmap)",
  },
  {
    key: "deployFailures",
    label: "Deploy failures máx.",
    category: "quality",
    unit: "",
    direction: "lowerIsBetter",
    role: "TL",
    help: "Despliegues fallidos en el período.",
    action: "Reforzá automatización y rollback del release.",
    healthy: 0,
    risk: 2,
    min: 0,
    max: 20,
    step: 1,
  },
  // Producto
  {
    key: "reopened",
    label: "Historias reabiertas máx.",
    category: "product",
    unit: "",
    direction: "lowerIsBetter",
    role: "PO",
    help: "Tareas dadas por terminadas que vuelven a abrirse.",
    action: "Reforzá criterios de aceptación y definición de terminado.",
    healthy: 1,
    risk: 3,
    min: 0,
    max: 20,
    step: 1,
    source: "Jira (roadmap)",
  },
  // Equipo
  {
    key: "staleTickets",
    label: "Tickets sin actualización máx.",
    category: "team",
    unit: "",
    direction: "lowerIsBetter",
    role: "TL",
    help: "Ítems sin movimiento durante varios días.",
    action: "Revisá foco y comunicación de bloqueos en la daily.",
    healthy: 2,
    risk: 5,
    min: 0,
    max: 30,
    step: 1,
  },
];

export const CATEGORY_LABEL: Record<MetricCategory, string> = {
  delivery: "Delivery",
  quality: "Calidad técnica",
  product: "Producto",
  team: "Equipo",
};

// --------------------------- Score de salud (pesos) -------------------------

export type ScoreDimension =
  | "delivery"
  | "quality"
  | "product"
  | "team"
  | "risk";

export const DIMENSION_LABEL: Record<ScoreDimension, string> = {
  delivery: "Delivery",
  quality: "Calidad técnica",
  product: "Producto",
  team: "Equipo",
  risk: "Riesgo",
};

export const DEFAULT_WEIGHTS: Record<ScoreDimension, number> = {
  delivery: 30,
  quality: 25,
  product: 20,
  team: 15,
  risk: 10,
};

// ------------------------------- Estándar -----------------------------------

export interface MetricThreshold {
  healthy: number;
  risk: number;
}

export interface HealthStandardConfig {
  thresholds: Record<string, MetricThreshold>;
  weights: Record<ScoreDimension, number>;
}

/** Estándar base recomendado, derivado del catálogo. */
export const DEFAULT_STANDARD: HealthStandardConfig = {
  thresholds: Object.fromEntries(
    METRIC_DEFS.map((m) => [m.key, { healthy: m.healthy, risk: m.risk }]),
  ),
  weights: { ...DEFAULT_WEIGHTS },
};

/** Combina un estándar parcial/custom sobre los valores base (defensivo). */
export function mergeStandard(
  custom: Partial<HealthStandardConfig> | null | undefined,
): HealthStandardConfig {
  if (!custom) return structuredCloneSafe(DEFAULT_STANDARD);
  const thresholds: Record<string, MetricThreshold> = {};
  for (const m of METRIC_DEFS) {
    const c = custom.thresholds?.[m.key];
    thresholds[m.key] = {
      healthy: numOr(c?.healthy, m.healthy),
      risk: numOr(c?.risk, m.risk),
    };
  }
  const weights = { ...DEFAULT_WEIGHTS, ...(custom.weights ?? {}) };
  return { thresholds, weights };
}

export type MetricState = "healthy" | "watch" | "risk";

/** Evalúa un valor real contra el umbral de una métrica. */
export function evaluateMetric(def: MetricDef, value: number, th: MetricThreshold): MetricState {
  if (def.direction === "higherIsBetter") {
    if (value >= th.healthy) return "healthy";
    if (value >= th.risk) return "watch";
    return "risk";
  }
  // lowerIsBetter
  if (value <= th.healthy) return "healthy";
  if (value <= th.risk) return "watch";
  return "risk";
}

export function weightsSum(w: Record<ScoreDimension, number>): number {
  return (Object.values(w) as number[]).reduce((a, b) => a + b, 0);
}

export function weightsBalanced(w: Record<ScoreDimension, number>): boolean {
  return weightsSum(w) === 100;
}

/** Valida coherencia de un threshold según la dirección de la métrica. */
export function thresholdValid(def: MetricDef, th: MetricThreshold): boolean {
  if (def.direction === "higherIsBetter") return th.healthy >= th.risk;
  return th.healthy <= th.risk;
}

// helpers
function numOr(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
function structuredCloneSafe<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

// ---------------------------------------------------------------------------
// Motor de scoring: el estándar (umbrales + pesos) alimenta el score real.
// ---------------------------------------------------------------------------

const CATEGORY_TO_DIMENSION: Record<MetricCategory, ScoreDimension> = {
  delivery: "delivery",
  quality: "quality",
  product: "product",
  team: "team",
};

const STATE_SCORE: Record<MetricState, number> = {
  healthy: 100,
  watch: 65,
  risk: 25,
};

/**
 * Lee el valor real de una métrica desde ReportMetrics.
 * Devuelve null cuando no hay fuente para esa métrica ("sin datos"): esas
 * métricas se excluyen del score y bajan la confianza (nunca puntúan 0).
 */
export function metricValue(key: string, m: ReportMetrics): number | null {
  switch (key) {
    case "completionRate":
      return m.projectProgress?.completionByPoints ?? null;
    case "commitmentReliability": {
      const committed = m.capacity?.committedPoints ?? 0;
      if (committed <= 0) return null;
      return Math.round(((m.capacity?.completedPoints ?? 0) / committed) * 100);
    }
    case "scopeCreep":
      return m.quality?.scopeCreepPct ?? null;
    case "blocked":
      return m.workItems?.blocked ?? null;
    case "carryOver":
      return m.planning?.carryOverItems ?? null;
    case "cycleTime":
      return m.capacity?.cycleTimeAvgDays ?? null; // null si no hay dato
    case "prOpenAge":
      return m.codeChanges && m.codeChanges.total > 0
        ? m.codeChanges.avgOpenAgeHours
        : null; // sin código conectado => sin datos
    case "reviewTime":
      return null; // requiere fuente de tiempo de review (roadmap)
    case "bugs":
      return m.quality?.bugsOpen ?? null;
    case "coverage":
      return null; // requiere integración de cobertura (roadmap)
    case "deployFailures":
      return m.ci && m.ci.total > 0 ? m.ci.deployFailed : null;
    case "reopened":
      return null; // requiere fuente de reaperturas (roadmap)
    case "staleTickets":
      return m.workItems?.stale ?? null;
    default:
      return null;
  }
}

export interface ScoredMetric {
  key: string;
  label: string;
  category: MetricCategory;
  value: number;
  unit: string;
  state: MetricState;
}

export interface StandardScore {
  score: number | null; // null => sin datos suficientes
  level: ScoreLevel | "SIN_DATOS";
  confidence: number; // 0-1 (fracción de dimensiones con datos)
  dimensions: {
    dim: ScoreDimension;
    score: number | null;
    weight: number;
  }[];
  worst: ScoredMetric[]; // razones principales (peores primero)
  evaluated: ScoredMetric[];
  missing: { key: string; label: string }[];
}

/**
 * Calcula el score de salud 0-100 aplicando el estándar (umbrales + pesos)
 * sobre las métricas reales. Maneja "sin datos" y devuelve un desglose
 * explicable (qué dimensión, qué métricas pesaron).
 */
export function scoreWithStandard(
  m: ReportMetrics | null | undefined,
  std: HealthStandardConfig,
): StandardScore {
  const evaluated: ScoredMetric[] = [];
  const missing: { key: string; label: string }[] = [];

  if (m) {
    for (const def of METRIC_DEFS) {
      const v = metricValue(def.key, m);
      if (v === null) {
        missing.push({ key: def.key, label: def.label });
        continue;
      }
      const th = std.thresholds[def.key] ?? { healthy: def.healthy, risk: def.risk };
      evaluated.push({
        key: def.key,
        label: def.label,
        category: def.category,
        value: v,
        unit: def.unit,
        state: evaluateMetric(def, v, th),
      });
    }
  }

  // Sub-score por dimensión (promedio de los stateScore de sus métricas).
  const byDim = new Map<ScoreDimension, number[]>();
  for (const e of evaluated) {
    const dim = CATEGORY_TO_DIMENSION[e.category];
    if (!byDim.has(dim)) byDim.set(dim, []);
    byDim.get(dim)!.push(STATE_SCORE[e.state]);
  }

  // Dimensión "riesgo": penalización compuesta a partir de work items y CI.
  let riskDim: number | null = null;
  if (m?.workItems) {
    const w = m.workItems;
    const ciFailed = m.ci?.failed ?? 0;
    riskDim = Math.max(
      0,
      Math.min(
        100,
        100 - w.blocked * 8 - w.critical * 10 - w.stale * 3 - ciFailed * 4,
      ),
    );
  }

  const dims: StandardScore["dimensions"] = (
    Object.keys(DIMENSION_LABEL) as ScoreDimension[]
  ).map((dim) => {
    const weight = std.weights[dim] ?? DEFAULT_WEIGHTS[dim];
    if (dim === "risk") return { dim, score: riskDim, weight };
    const arr = byDim.get(dim);
    const score =
      arr && arr.length > 0
        ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
        : null;
    return { dim, score, weight };
  });

  const available = dims.filter((d) => d.score !== null);
  const totalWeight = available.reduce((a, d) => a + d.weight, 0);
  const rawScore =
    totalWeight > 0
      ? Math.round(
          available.reduce((a, d) => a + (d.score as number) * d.weight, 0) /
            totalWeight,
        )
      : null;

  // Confianza: cuántas dimensiones (de 5) tienen datos.
  const confidence = available.length / dims.length;

  const worst = [...evaluated]
    .filter((e) => e.state !== "healthy")
    .sort(
      (a, b) => STATE_SCORE[a.state] - STATE_SCORE[b.state],
    )
    .slice(0, 3);

  const level: ScoreLevel | "SIN_DATOS" =
    rawScore === null || confidence < 0.4 ? "SIN_DATOS" : levelOf(rawScore);

  return {
    score: rawScore,
    level,
    confidence,
    dimensions: dims,
    worst,
    evaluated,
    missing,
  };
}

// ---------------------------------------------------------------------------
// Perfiles predefinidos (presets). Team elige; Pro crea propios.
// ---------------------------------------------------------------------------

export interface StandardPreset {
  id: string;
  name: string;
  when: string;
  config: HealthStandardConfig;
}

function preset(
  thresholds: Record<string, MetricThreshold>,
  weights: Record<ScoreDimension, number>,
): HealthStandardConfig {
  return mergeStandard({ thresholds, weights });
}

export interface StandardDiff {
  thresholds: {
    key: string;
    label: string;
    field: "healthy" | "risk";
    from: number;
    to: number;
  }[];
  weights: { dim: ScoreDimension; label: string; from: number; to: number }[];
}

/** Diferencias entre dos estándares (para historial/versionado). */
export function diffStandards(
  from: HealthStandardConfig,
  to: HealthStandardConfig,
): StandardDiff {
  const thresholds: StandardDiff["thresholds"] = [];
  for (const def of METRIC_DEFS) {
    const a = from.thresholds[def.key];
    const b = to.thresholds[def.key];
    if (!a || !b) continue;
    (["healthy", "risk"] as const).forEach((f) => {
      if (a[f] !== b[f])
        thresholds.push({ key: def.key, label: def.label, field: f, from: a[f], to: b[f] });
    });
  }
  const weights: StandardDiff["weights"] = [];
  for (const dim of Object.keys(DIMENSION_LABEL) as ScoreDimension[]) {
    if (from.weights[dim] !== to.weights[dim])
      weights.push({
        dim,
        label: DIMENSION_LABEL[dim],
        from: from.weights[dim],
        to: to.weights[dim],
      });
  }
  return { thresholds, weights };
}

/**
 * Umbrales dinámicos (Pro): sugiere healthy/risk a partir del histórico real
 * del equipo (últimos reportes). Para cada métrica toma la mediana de los
 * valores disponibles y define bandas alrededor según la dirección. Así el
 * estándar se ajusta al ritmo del equipo en lugar de un número genérico.
 */
export function computeBaselineThresholds(
  history: ReportMetrics[],
): Record<string, MetricThreshold> {
  const out: Record<string, MetricThreshold> = {};
  for (const def of METRIC_DEFS) {
    const values = history
      .map((m) => metricValue(def.key, m))
      .filter((v): v is number => v !== null);
    if (values.length < 2) {
      // sin suficiente histórico: mantené el recomendado
      out[def.key] = { healthy: def.healthy, risk: def.risk };
      continue;
    }
    values.sort((a, b) => a - b);
    const median = values[Math.floor(values.length / 2)];
    const clamp = (n: number) =>
      Math.max(def.min, Math.min(def.max, Math.round(n)));
    if (def.direction === "higherIsBetter") {
      // saludable cerca de lo que el equipo suele lograr; riesgo un escalón abajo
      out[def.key] = { healthy: clamp(median * 0.95), risk: clamp(median * 0.8) };
    } else {
      // lowerIsBetter: saludable en su valor típico; riesgo si empeora ~40%
      out[def.key] = {
        healthy: clamp(median * 1.1),
        risk: clamp(median * 1.4 + 1),
      };
    }
  }
  return out;
}

export const PRESETS: StandardPreset[] = [
  {
    id: "balanced",
    name: "Balanced Team",
    when: "Punto de partida recomendado para la mayoría de los equipos.",
    config: structuredCloneSafe(DEFAULT_STANDARD),
  },
  {
    id: "new",
    name: "New Team",
    when: "Equipo nuevo o recién formado: estándares más flexibles los primeros sprints.",
    config: preset(
      {
        completionRate: { healthy: 70, risk: 55 },
        scopeCreep: { healthy: 20, risk: 35 },
        blocked: { healthy: 3, risk: 6 },
        carryOver: { healthy: 4, risk: 8 },
        cycleTime: { healthy: 5, risk: 9 },
      },
      { delivery: 25, quality: 20, product: 15, team: 30, risk: 10 },
    ),
  },
  {
    id: "high-perf",
    name: "High-Performance Team",
    when: "Equipo maduro y senior: exigencia alta en previsibilidad y calidad.",
    config: preset(
      {
        completionRate: { healthy: 90, risk: 78 },
        cycleTime: { healthy: 2, risk: 4 },
        reviewTime: { healthy: 6, risk: 16 },
        bugs: { healthy: 2, risk: 5 },
        prOpenAge: { healthy: 16, risk: 48 },
      },
      { delivery: 30, quality: 30, product: 20, team: 10, risk: 10 },
    ),
  },
  {
    id: "critical",
    name: "Critical Project",
    when: "Proyecto de alta criticidad: tolerancia mínima a bugs, deploys e incidentes.",
    config: preset(
      {
        bugs: { healthy: 1, risk: 3 },
        deployFailures: { healthy: 0, risk: 1 },
        coverage: { healthy: 85, risk: 72 },
        reopened: { healthy: 0, risk: 2 },
      },
      { delivery: 20, quality: 35, product: 15, team: 10, risk: 20 },
    ),
  },
  {
    id: "maintenance",
    name: "Maintenance & Support",
    when: "Equipo de mantenimiento o guardias: prioriza estabilidad, no velocity.",
    config: preset(
      {
        completionRate: { healthy: 70, risk: 55 },
        bugs: { healthy: 4, risk: 10 },
        deployFailures: { healthy: 0, risk: 1 },
        staleTickets: { healthy: 3, risk: 7 },
      },
      { delivery: 15, quality: 30, product: 10, team: 15, risk: 30 },
    ),
  },
  {
    id: "part-time",
    name: "Part-time Team",
    when: "Equipo part-time o compartido: expectativas de ritmo ajustadas a su capacidad.",
    config: preset(
      {
        completionRate: { healthy: 70, risk: 55 },
        cycleTime: { healthy: 5, risk: 9 },
        carryOver: { healthy: 4, risk: 8 },
      },
      { delivery: 20, quality: 25, product: 20, team: 20, risk: 15 },
    ),
  },
];
