// Filtro de inactividad de personas.
//
// Los equipos cambian: la empresa desvincula o reemplaza gente en los proyectos.
// Un/a integrante que dejó de tener actividad en TODAS las integraciones hace más
// de N días (default 30) ya no es relevante para el estado ACTUAL del proyecto,
// así que se lo excluye de reportes, matriz y demás vistas de personas.
//
// La inactividad se mide contra HOY (no contra el fin del período del reporte):
// lo que importa es si la persona sigue activa "hoy por hoy" en el proyecto.
// La ventana es configurable vía la env `REPORT_INACTIVE_DAYS`.

const DEFAULT_INACTIVE_DAYS = 30;

/**
 * Días de inactividad tolerados antes de excluir a una persona. Configurable
 * con `REPORT_INACTIVE_DAYS`. Valores no válidos (<= 0, no numéricos) caen al
 * default de 30 días.
 */
export function inactiveThresholdDays(): number {
  const raw = process.env.REPORT_INACTIVE_DAYS;
  if (!raw) return DEFAULT_INACTIVE_DAYS;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_INACTIVE_DAYS;
}

/** ms en un día. */
const DAY_MS = 24 * 60 * 60 * 1000;

/** Parsea un ISO a epoch ms, o null si es vacío/ inválido. */
function iso(ms: string | null | undefined): number | null {
  if (!ms) return null;
  const t = new Date(ms).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * Devuelve el más reciente de dos timestamps ISO (o el que exista). Útil para
 * ir acumulando la última actividad de una persona al fusionar identidades.
 */
export function maxIso(
  a: string | null | undefined,
  b: string | null | undefined,
): string | null {
  const ta = iso(a);
  const tb = iso(b);
  if (ta === null) return b ?? null;
  if (tb === null) return a ?? null;
  return ta >= tb ? (a as string) : (b as string);
}

export interface ActivityWindowOpts {
  /** Momento de referencia (default: ahora). */
  now?: number;
  /** Ventana de inactividad en días (default: `inactiveThresholdDays()`). */
  days?: number;
}

/**
 * ¿La persona sigue activa? Se la considera activa si su última actividad
 * conocida está dentro de la ventana. Si NO conocemos su última actividad
 * (`lastActivityAt` nulo, p. ej. reportes viejos previos a esta capa) se la
 * trata como activa: no excluimos por falta de dato, igual que el resto del
 * pipeline nunca descarta ítems por fechas nulas.
 */
export function isPersonActive(
  lastActivityAt: string | null | undefined,
  opts: ActivityWindowOpts = {},
): boolean {
  const t = iso(lastActivityAt);
  if (t === null) return true;
  const now = opts.now ?? Date.now();
  const days = opts.days ?? inactiveThresholdDays();
  return now - t <= days * DAY_MS;
}

/**
 * Filtra una lista de personas dejando solo las activas según la ventana de
 * inactividad. Genérico sobre cualquier objeto con `lastActivityAt`.
 */
export function filterActivePeople<T extends { lastActivityAt?: string | null }>(
  people: T[],
  opts: ActivityWindowOpts = {},
): T[] {
  // Resolvemos now/days una vez para que todas las filas usen el mismo corte.
  const resolved: ActivityWindowOpts = {
    now: opts.now ?? Date.now(),
    days: opts.days ?? inactiveThresholdDays(),
  };
  return people.filter((p) => isPersonActive(p.lastActivityAt, resolved));
}
