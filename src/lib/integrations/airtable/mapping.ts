// ---------------------------------------------------------------------------
// Mapeo configurable de columnas de Airtable → campos de DevMetrics
// ---------------------------------------------------------------------------
//
// El problema: cada cliente nombra sus columnas distinto ("Participante" en vez
// de "Name", "Mail corporativo" en vez de "Email", "Responsable de la tarea" en
// vez de "Assignee"). La integración NUNCA debe fallar por no encontrar un
// nombre de columna fijo.
//
// Esta capa es pura y determinista. Dado el conjunto de columnas reales de una
// tabla (con tipo, ejemplos y estadísticas), sugiere qué columna corresponde a
// cada campo lógico de DevMetrics, con un nivel de confianza. El usuario luego
// puede corregir cualquier sugerencia; nunca se aplica en silencio si hay
// ambigüedad.

/** Campos lógicos que DevMetrics sabe consumir. */
export type DevMetricsField =
  | "collaboratorName"
  | "email"
  | "assignee"
  | "collaboratorId"
  | "status"
  | "createdAt"
  | "startedAt"
  | "finishedAt"
  | "sprint"
  | "project"
  | "priority"
  | "estimatedHours"
  | "actualHours"
  | "taskType"
  | "storyPoints"
  | "title"
  | "extra";

export interface DevMetricsFieldSpec {
  key: DevMetricsField;
  /** Etiqueta legible (es-AR). */
  label: string;
  /** Sinónimos (normalizados) frecuentes del nombre de columna. */
  synonyms: string[];
  /** Tipos de campo de Airtable preferidos para este destino. */
  preferredTypes?: string[];
  /** Si el destino se resuelve mejor inspeccionando el contenido (email, etc.). */
  contentKind?: "email" | "date" | "number" | "person";
}

/** Catálogo de campos de DevMetrics con sus sinónimos y pistas de tipo. */
export const DEVMETRICS_FIELDS: DevMetricsFieldSpec[] = [
  {
    key: "collaboratorName",
    label: "Nombre del colaborador",
    synonyms: [
      "name",
      "nombre",
      "participante",
      "colaborador",
      "persona",
      "integrante",
      "miembro",
      "full name",
      "nombre completo",
      "nombre y apellido",
      "developer name",
    ],
    preferredTypes: ["singleLineText", "multilineText", "formula", "rollup"],
  },
  {
    key: "email",
    label: "Correo electrónico",
    synonyms: [
      "email",
      "e-mail",
      "correo",
      "correo electronico",
      "mail",
      "mail corporativo",
      "email corporativo",
      "correo corporativo",
    ],
    preferredTypes: ["email", "singleLineText"],
    contentKind: "email",
  },
  {
    key: "assignee",
    label: "Responsable de la tarea",
    synonyms: [
      "assignee",
      "responsable",
      "responsable de la tarea",
      "asignado",
      "asignado a",
      "owner",
      "developer",
      "encargado",
      "a cargo",
      "assigned to",
      "dueno",
      "duenio",
    ],
    preferredTypes: [
      "multipleCollaborators",
      "singleCollaborator",
      "collaborator",
      "multipleRecordLinks",
      "singleRecordLink",
    ],
    contentKind: "person",
  },
  {
    key: "collaboratorId",
    label: "Identificador del colaborador",
    synonyms: [
      "id",
      "identificador",
      "external id",
      "id externo",
      "github",
      "github id",
      "github username",
      "usuario github",
      "handle",
      "username",
      "user",
      "legajo",
    ],
    preferredTypes: ["singleLineText", "number", "autoNumber"],
  },
  {
    key: "status",
    label: "Estado de la tarea",
    synonyms: [
      "status",
      "estado",
      "estado actual",
      "estado de la tarea",
      "situacion",
      "etapa",
      "stage",
      "fase",
      "progress",
    ],
    preferredTypes: ["singleSelect", "singleLineText"],
  },
  {
    key: "createdAt",
    label: "Fecha de creación",
    synonyms: [
      "created",
      "created time",
      "fecha de creacion",
      "creado",
      "alta",
      "fecha alta",
    ],
    preferredTypes: ["date", "dateTime", "createdTime"],
    contentKind: "date",
  },
  {
    key: "startedAt",
    label: "Fecha de inicio",
    synonyms: [
      "start",
      "start date",
      "fecha de inicio",
      "inicio",
      "comienzo",
      "fecha inicio",
    ],
    preferredTypes: ["date", "dateTime"],
    contentKind: "date",
  },
  {
    key: "finishedAt",
    label: "Fecha de finalización",
    synonyms: [
      "end",
      "end date",
      "due",
      "due date",
      "fecha de finalizacion",
      "fin",
      "finalizacion",
      "fecha fin",
      "entrega",
      "completado",
      "cierre",
    ],
    preferredTypes: ["date", "dateTime"],
    contentKind: "date",
  },
  {
    key: "sprint",
    label: "Sprint",
    synonyms: ["sprint", "iteracion", "iteration", "ciclo", "milestone", "hito"],
    preferredTypes: ["singleSelect", "singleLineText", "multipleRecordLinks"],
  },
  {
    key: "project",
    label: "Proyecto",
    synonyms: ["project", "proyecto", "producto", "product", "cliente", "cuenta"],
    preferredTypes: ["singleSelect", "singleLineText", "multipleRecordLinks"],
  },
  {
    key: "priority",
    label: "Prioridad",
    synonyms: ["priority", "prioridad", "importancia", "severidad", "severity"],
    preferredTypes: ["singleSelect", "singleLineText"],
  },
  {
    key: "estimatedHours",
    label: "Horas estimadas",
    synonyms: [
      "estimated hours",
      "horas estimadas",
      "estimacion",
      "estimate",
      "horas estimadas totales",
      "esfuerzo estimado",
    ],
    preferredTypes: ["number", "duration"],
    contentKind: "number",
  },
  {
    key: "actualHours",
    label: "Horas reales",
    synonyms: [
      "actual hours",
      "horas reales",
      "horas trabajadas",
      "tiempo real",
      "logged hours",
      "horas dedicadas",
    ],
    preferredTypes: ["number", "duration"],
    contentKind: "number",
  },
  {
    key: "taskType",
    label: "Tipo de tarea",
    synonyms: [
      "type",
      "tipo",
      "tipo de tarea",
      "categoria",
      "category",
      "clase",
      "kind",
    ],
    preferredTypes: ["singleSelect", "singleLineText"],
  },
  {
    key: "storyPoints",
    label: "Story points",
    synonyms: [
      "story points",
      "puntos",
      "puntos de historia",
      "sp",
      "points",
      "esfuerzo",
    ],
    preferredTypes: ["number"],
    contentKind: "number",
  },
  {
    key: "title",
    label: "Título de la tarea",
    synonyms: [
      "title",
      "titulo",
      "tarea",
      "task",
      "resumen",
      "summary",
      "descripcion",
      "description",
      "nombre de la tarea",
    ],
    preferredTypes: ["singleLineText", "multilineText"],
  },
  {
    key: "extra",
    label: "Campo adicional",
    synonyms: [],
  },
];

/** Descripción de una columna real de una tabla de Airtable. */
export interface ColumnDescriptor {
  /** Nombre exacto de la columna en Airtable. */
  name: string;
  /** Tipo de campo Airtable (singleLineText, email, singleSelect, ...). */
  type: string;
  /** Muestra de valores no vacíos (ya stringificados). */
  samples: string[];
  /** Total de registros muestreados. */
  sampleCount: number;
  /** Registros con valor no vacío en la muestra. */
  filledCount: number;
  /** true si el campo admite múltiples valores. */
  multiValue: boolean;
  /** true si es un vínculo a otra tabla. */
  linked: boolean;
  /** Id de la tabla vinculada, si aplica. */
  linkedTableId?: string;
}

export type MappingConfidence = "alta" | "media" | "requiere_validacion";

export interface FieldSuggestion {
  field: DevMetricsField;
  label: string;
  /** Columna sugerida (o null si no se encontró candidata razonable). */
  column: string | null;
  confidence: MappingConfidence;
  reason: string;
  /** Otras columnas candidatas ordenadas por score (para el dropdown). */
  alternatives: string[];
}

/** Un mapeo confirmado: campo lógico → nombre de columna real (o null). */
export type FieldMap = Partial<Record<DevMetricsField, string | null>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Normaliza un nombre de columna para comparar contra sinónimos. */
export function normalizeColumnName(name: string): string {
  return stripAccents(name.toLowerCase())
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokenSet(s: string): Set<string> {
  return new Set(normalizeColumnName(s).split(" ").filter(Boolean));
}

/** ¿La muestra de la columna parece contener emails? */
function looksLikeEmailColumn(col: ColumnDescriptor): boolean {
  if (col.samples.length === 0) return false;
  const hits = col.samples.filter((s) => EMAIL_RE.test(s.trim())).length;
  return hits / col.samples.length >= 0.6;
}

/** ¿La muestra parece contener números? */
function looksLikeNumberColumn(col: ColumnDescriptor): boolean {
  if (col.samples.length === 0) return false;
  const hits = col.samples.filter(
    (s) => s.trim() !== "" && !Number.isNaN(Number(s.replace(",", "."))),
  ).length;
  return hits / col.samples.length >= 0.8;
}

/** Score 0..1 de qué tan bien una columna encaja en un campo destino. */
function scoreColumn(
  spec: DevMetricsFieldSpec,
  col: ColumnDescriptor,
): { score: number; reason: string } {
  const norm = normalizeColumnName(col.name);
  const colTokens = tokenSet(col.name);
  let best = 0;
  let reason = "";

  // 1) Coincidencia por nombre / sinónimos.
  for (const syn of spec.synonyms) {
    if (norm === syn) {
      best = Math.max(best, 1);
      reason = `el nombre coincide con "${syn}"`;
      continue;
    }
    const synTokens = new Set(syn.split(" ").filter(Boolean));
    const shared = [...synTokens].filter((t) => colTokens.has(t));
    if (synTokens.size > 0 && shared.length === synTokens.size) {
      // La columna contiene todas las palabras del sinónimo.
      if (best < 0.9) {
        best = 0.9;
        reason = `el nombre contiene "${syn}"`;
      }
    } else if (shared.length > 0) {
      const partial = 0.5 + 0.2 * (shared.length / synTokens.size);
      if (best < partial) {
        best = partial;
        reason = `el nombre comparte "${shared.join(" ")}"`;
      }
    }
  }

  // 2) Señal por tipo de campo.
  if (spec.preferredTypes?.includes(col.type)) {
    best = Math.max(best, best > 0 ? Math.min(1, best + 0.1) : 0.55);
    if (!reason) reason = `el tipo de campo es ${col.type}`;
  }

  // 3) Señal por contenido.
  if (spec.contentKind === "email" && looksLikeEmailColumn(col)) {
    best = Math.max(best, 0.85);
    reason = reason
      ? `${reason}; los valores parecen emails`
      : "los valores parecen emails";
  }
  if (spec.contentKind === "number" && looksLikeNumberColumn(col)) {
    best = Math.max(best, best > 0 ? Math.min(1, best + 0.05) : 0.5);
    if (!reason) reason = "los valores son numéricos";
  }
  if (spec.contentKind === "person" && (col.linked || col.type.includes("ollaborator"))) {
    best = Math.max(best, best > 0 ? Math.min(1, best + 0.1) : 0.6);
    if (!reason) reason = col.linked ? "es un vínculo a otra tabla" : "es un campo de colaborador";
  }

  return { score: best, reason };
}

function confidenceFromScore(score: number): MappingConfidence {
  if (score >= 0.85) return "alta";
  if (score >= 0.55) return "media";
  return "requiere_validacion";
}

/**
 * Sugiere el mapeo columna→campo para todas las columnas de una tabla.
 * Nunca asigna dos campos a la misma columna salvo empate real; resuelve
 * conflictos dando la columna al campo con mayor score.
 */
export function suggestFieldMapping(
  columns: ColumnDescriptor[],
): FieldSuggestion[] {
  // Matriz de scores [field][column].
  const scores = new Map<DevMetricsField, Map<string, { score: number; reason: string }>>();
  for (const spec of DEVMETRICS_FIELDS) {
    if (spec.key === "extra") continue;
    const row = new Map<string, { score: number; reason: string }>();
    for (const col of columns) row.set(col.name, scoreColumn(spec, col));
    scores.set(spec.key, row);
  }

  // Asignación greedy por mejor score global, sin reutilizar columnas.
  const takenColumns = new Set<string>();
  const assigned = new Map<DevMetricsField, { column: string; score: number; reason: string }>();

  type Cell = { field: DevMetricsField; column: string; score: number; reason: string };
  const cells: Cell[] = [];
  for (const [field, row] of scores) {
    for (const [column, { score, reason }] of row) {
      if (score > 0) cells.push({ field, column, score, reason });
    }
  }
  cells.sort((a, b) => b.score - a.score);

  for (const c of cells) {
    if (assigned.has(c.field)) continue;
    if (takenColumns.has(c.column)) continue;
    // Un campo con score bajo (<0.5) no consume la columna: queda para otro
    // campo que la use mejor y se marcará como "requiere validación".
    if (c.score < 0.5 && assigned.size < scores.size) {
      // permitimos igual, pero sin bloquear la columna con fuerza
    }
    assigned.set(c.field, { column: c.column, score: c.score, reason: c.reason });
    takenColumns.add(c.column);
  }

  return DEVMETRICS_FIELDS.filter((s) => s.key !== "extra").map((spec) => {
    const hit = assigned.get(spec.key);
    const row = scores.get(spec.key)!;
    const alternatives = [...row.entries()]
      .filter(([col, v]) => v.score > 0 && col !== hit?.column)
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, 4)
      .map(([col]) => col);
    if (!hit) {
      return {
        field: spec.key,
        label: spec.label,
        column: null,
        confidence: "requiere_validacion" as const,
        reason: "no se encontró una columna candidata",
        alternatives,
      };
    }
    return {
      field: spec.key,
      label: spec.label,
      column: hit.column,
      confidence: confidenceFromScore(hit.score),
      reason: hit.reason,
      alternatives,
    };
  });
}

/** Construye un FieldMap a partir de sugerencias (para arrancar el formulario). */
export function suggestionsToFieldMap(suggestions: FieldSuggestion[]): FieldMap {
  const map: FieldMap = {};
  for (const s of suggestions) map[s.field] = s.column;
  return map;
}

/**
 * Elige la mejor columna para un campo lógico usando SOLO los nombres de columna
 * disponibles (sin muestras ni tipos). Pensado para el adapter en tiempo de
 * lectura, donde solo conocemos las claves presentes en los registros. Devuelve
 * null si ninguna columna alcanza un match razonable.
 */
export function bestColumnByName(
  field: DevMetricsField,
  names: string[],
): string | null {
  const spec = DEVMETRICS_FIELDS.find((s) => s.key === field);
  if (!spec) return null;
  let best: { name: string; score: number } | null = null;
  for (const name of names) {
    const col: ColumnDescriptor = {
      name,
      type: "unknown",
      samples: [],
      sampleCount: 0,
      filledCount: 0,
      multiValue: false,
      linked: false,
    };
    const { score } = scoreColumn(spec, col);
    if (score > 0 && (!best || score > best.score)) best = { name, score };
  }
  return best && best.score >= 0.5 ? best.name : null;
}

/** Parsea un FieldMap serializado en la config de la integración. */
export function parseFieldMap(raw: unknown): FieldMap {
  if (!raw) return {};
  try {
    const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (obj && typeof obj === "object") return obj as FieldMap;
  } catch {
    // config malformada: se ignora y se cae a la heurística.
  }
  return {};
}
