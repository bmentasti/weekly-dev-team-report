// ---------------------------------------------------------------------------
// Identidad canónica de personas (cross-app)
// ---------------------------------------------------------------------------
//
// Problema que resuelve: cada integración identifica a las personas con su
// propio string (GitHub → login, Airtable → record id "rec...", etc.). Si se
// agrupa por ese string crudo, la MISMA persona aparece duplicada en cada app
// y sumar apps multiplica los duplicados.
//
// Esta capa asigna a cada persona un ID ÚNICO y ESTABLE (determinista) y unifica
// los distintos identificadores contra ese ID:
//   1. Normaliza (trim, saca "@", colapsa espacios, minúsculas).
//   2. Detecta emails y IDs opacos (record ids) para no confundirlos con nombres.
//   3. Aplica una tabla de alias editable por proyecto para fusionar lo que no
//      coincide solo (p. ej. "recAmn3..." de Airtable ↔ "gonzaloavalos29" de GitHub).
//
// El ID es determinista: re-generar un reporte nunca crea un ID nuevo, y agregar
// una app no duplica a una persona ya conocida siempre que su handle normalice
// al mismo canónico o exista un alias que lo mapee.

export interface PersonRef {
  /** Slug del provider (github, airtable, ...) o null si se desconoce. */
  source: string | null;
  /** Identificador crudo tal como lo devuelve la app. */
  handle: string;
  /**
   * Email de la persona si la app lo expone. Es la CLAVE UNIVERSAL: si está
   * presente, define la identidad canónica (mismo email ⇒ misma persona en
   * cualquier app), con prioridad sobre la heurística de nombre.
   */
  email?: string | null;
}

export interface ResolvedIdentity {
  /** ID canónico único y estable de la persona dentro del proyecto. */
  id: string;
  /** Nombre para mostrar (amigable). */
  name: string;
}

/** Una identidad canónica declarada (fila de PersonIdentity). */
export interface IdentityRecord {
  /** Clave canónica (= ID único de la persona). */
  key: string;
  displayName: string;
}

/** Un alias que mapea un handle de una app a una identidad (fila de PersonAlias). */
export interface AliasRecord {
  /** Slug del provider, o "*" para cualquier app. */
  source: string;
  /** Handle crudo (o ID canónico de otra persona) que se fusiona. */
  handle: string;
  /** Clave canónica de la identidad destino. */
  canonicalId: string;
  /** Nombre para mostrar de la identidad destino. */
  displayName: string;
}

export interface IdentityConfig {
  identities: IdentityRecord[];
  aliases: AliasRecord[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Record ids opacos estilo Airtable ("rec" + 14+ alfanuméricos).
const OPAQUE_RE = /^rec[a-z0-9]{14,}$/i;

/** Normaliza un handle para comparaciones estables. */
export function normalizeHandle(raw: string): string {
  return raw
    .trim()
    .replace(/^@+/, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function isOpaque(handle: string): boolean {
  return OPAQUE_RE.test(handle.trim());
}

/**
 * ID canónico determinista cuando NO hay alias. Namespacea emails e IDs opacos
 * para que no se confundan con nombres reales.
 *
 * El prefijo de IDs opacos (record ids) es source-independiente (`rec:`) a
 * propósito: así el MISMO record id produce el MISMO ID canónico tanto al
 * generar el reporte (donde conocemos la app) como al leerlo después (donde ya
 * no), evitando que la misma persona quede con dos claves distintas entre
 * reportes viejos y nuevos. Los record ids de Airtable son únicos, así que no
 * hay riesgo real de colisión.
 */
function deriveId(raw: string): string {
  const norm = normalizeHandle(raw);
  if (!norm) return "";
  if (EMAIL_RE.test(norm)) return `email:${norm}`;
  if (isOpaque(raw)) return `rec:${norm}`;
  return norm;
}

const ANY = "*";

/**
 * Construye un resolver a partir de la config de identidad del proyecto. El
 * resolver es puro y determinista.
 */
export function makeResolver(config: IdentityConfig) {
  // Mapa de lookup → { id, name }. Se indexan varias formas por alias para que
  // tanto el handle crudo como su ID derivado apunten a la misma identidad.
  const lookup = new Map<string, ResolvedIdentity>();
  // Nombre para mostrar por clave canónica (para handles primarios sin alias).
  const nameByKey = new Map<string, string>();

  for (const idn of config.identities) {
    if (idn.key) nameByKey.set(idn.key, idn.displayName || idn.key);
  }

  for (const a of config.aliases) {
    const target: ResolvedIdentity = {
      id: a.canonicalId,
      name: (a.displayName || nameByKey.get(a.canonicalId) || a.handle).trim(),
    };
    const norm = normalizeHandle(a.handle);
    const src = a.source || ANY;
    // Distintas formas bajo las que puede llegar el mismo handle.
    const keys = new Set<string>([
      `${src}::${norm}`,
      `${ANY}::${norm}`,
      norm,
      deriveId(a.handle),
    ]);
    for (const k of keys) if (k) lookup.set(k, target);
  }

  return function resolve(ref: PersonRef): ResolvedIdentity {
    const raw = (ref.handle ?? "").trim();
    const email = (ref.email ?? "").trim().toLowerCase();
    if (!raw && !email) return { id: "", name: "" };
    const norm = normalizeHandle(raw);
    const src = ref.source ?? null;

    // 1) Alias explícito (por handle, por email, o por id derivado).
    let hit: ResolvedIdentity | undefined;
    if (norm)
      hit =
        lookup.get(`${src ?? ANY}::${norm}`) ??
        lookup.get(`${ANY}::${norm}`) ??
        lookup.get(norm);
    if (!hit && email) hit = lookup.get(`email:${email}`);
    if (!hit && norm) hit = lookup.get(deriveId(raw));
    if (hit) return { ...hit };

    // 2) EMAIL = clave universal. Mismo email ⇒ misma persona en cualquier app.
    if (email && EMAIL_RE.test(email)) {
      const id = `email:${email}`;
      return { id, name: nameByKey.get(id) ?? (raw || email) };
    }

    // 3) Sin email ni alias: ID canónico determinista por nombre/handle.
    const id = deriveId(raw);
    return { id, name: nameByKey.get(id) ?? raw };
  };
}

export type Resolver = ReturnType<typeof makeResolver>;

/**
 * Resuelve una persona ya materializada en un reporte (`{ id?, name }`) a su
 * identidad canónica para AGRUPAR y MOSTRAR.
 *
 * Clave: nunca devuelve el ID interno como nombre. El nombre para mostrar es el
 * de una identidad declarada (alias) si existe; si no, el nombre original de la
 * persona (`p.name`). Así jamás se ve algo como "airtable:rec..." en pantalla.
 */
export function resolvePerson(
  resolve: Resolver,
  p: { id?: string; name: string },
): ResolvedIdentity {
  const handle = p.id ?? p.name;
  const r = resolve({ source: null, handle });
  // r.name === handle => no hubo identidad declarada: usá el nombre original.
  const name = r.name && r.name !== handle ? r.name : p.name;
  return { id: r.id || p.name, name };
}

/** Resolver identidad (helper directo para usos puntuales). */
export function resolveIdentity(
  ref: PersonRef,
  config: IdentityConfig = { identities: [], aliases: [] },
): ResolvedIdentity {
  return makeResolver(config)(ref);
}
