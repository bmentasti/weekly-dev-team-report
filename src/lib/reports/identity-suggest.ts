// Sugerencias automáticas de fusión de identidades.
//
// Dado el conjunto de personas canónicas actuales del proyecto, propone cuáles
// son PROBABLEMENTE la misma persona a partir de la similitud de sus nombres
// (variantes de un nombre real, handle con dígitos, nombre.apellido, etc.).
// Es solo una sugerencia: el usuario confirma cada fusión con un click.
//
// Nota: no puede adivinar que un record id opaco (sin nombre) es igual a un
// login; para eso hace falta que Airtable resuelva el nombre real o la fusión
// manual. Acá matcheamos por señal de nombre, que es explicable y de bajo riesgo.

export interface SuggestPerson {
  id: string;
  name: string;
}

export interface MergeSuggestion {
  /** IDs de las personas a fusionar (2+). El primero es el sugerido como primario. */
  ids: string[];
  /** Nombre para mostrar sugerido (el más "humano" del grupo). */
  displayName: string;
  confidence: "alta" | "media";
  reason: string;
}

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Forma normalizada: minúsculas, sin acentos, solo letras/números y espacios. */
function normalize(name: string): string {
  return stripAccents(name.toLowerCase())
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Forma compacta: solo letras (sin dígitos ni separadores). */
function compact(name: string): string {
  return stripAccents(name.toLowerCase()).replace(/[^a-z]+/g, "");
}

/** Tokens de nombre (>= 2 letras), sin dígitos. */
function tokens(name: string): string[] {
  return normalize(name)
    .split(" ")
    .map((t) => t.replace(/[0-9]+/g, ""))
    .filter((t) => t.length >= 2);
}

/** Un id/ nombre sin señal utilizable (record id opaco, email sin nombre, muy corto). */
function isUninformative(p: SuggestPerson): boolean {
  const c = compact(p.name);
  // Nombre que es literalmente un record id (rec + hex) o el id namespaced.
  if (/^rec[a-z0-9]{10,}$/i.test(p.name.trim())) return true;
  if (p.id.startsWith("rec:") && c.length < 3) return true;
  return c.length < 3;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

function ratio(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

interface PairScore {
  confidence: "alta" | "media";
  reason: string;
}

/** Puntúa la similitud entre dos personas. `null` si no se debe sugerir. */
function scorePair(a: SuggestPerson, b: SuggestPerson): PairScore | null {
  const ca = compact(a.name);
  const cb = compact(b.name);
  if (ca.length < 3 || cb.length < 3) return null;

  if (ca === cb) return { confidence: "alta", reason: "mismo nombre" };

  const shorter = ca.length <= cb.length ? ca : cb;
  const longer = ca.length <= cb.length ? cb : ca;
  if (shorter.length >= 5 && longer.includes(shorter))
    return { confidence: "alta", reason: "un nombre contiene al otro" };

  const ta = new Set(tokens(a.name));
  const tb = tokens(b.name);
  const shared = tb.filter((t) => ta.has(t));
  if (shared.length >= 2)
    return { confidence: "alta", reason: "comparten nombre y apellido" };
  if (shared.some((t) => t.length >= 5))
    return { confidence: "media", reason: `comparten "${shared.find((t) => t.length >= 5)}"` };

  const r = ratio(ca, cb);
  if (r >= 0.88 && Math.max(ca.length, cb.length) >= 5)
    return { confidence: "media", reason: "nombres muy parecidos" };

  return null;
}

/** Elige el nombre más "humano" del grupo para mostrar. */
function pickPrimary(members: SuggestPerson[]): SuggestPerson {
  return [...members].sort((a, b) => {
    const aSpace = a.name.trim().includes(" ") ? 1 : 0;
    const bSpace = b.name.trim().includes(" ") ? 1 : 0;
    if (aSpace !== bSpace) return bSpace - aSpace; // preferir nombre con espacio
    const aLetters = compact(a.name).length;
    const bLetters = compact(b.name).length;
    if (aLetters !== bLetters) return bLetters - aLetters; // más letras
    return a.name.length - b.name.length; // más corto
  })[0];
}

interface GroupResult {
  /** Miembros por raíz de componente. */
  groups: Map<string, SuggestPerson[]>;
  /** Raíz (find) por id. */
  rootOf: (id: string) => string;
  /** Info del par por clave "x|y". */
  pairInfo: Map<string, PairScore>;
}

/**
 * Agrupa personas por similitud con union-find. `accept` decide qué pares unir
 * (todos, o solo alta confianza para el auto-merge).
 */
function groupPeople(
  people: SuggestPerson[],
  accept: (s: PairScore) => boolean,
): GroupResult {
  const usable = people.filter((p) => !isUninformative(p));
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== undefined && parent.get(r) !== r) r = parent.get(r)!;
    return r;
  };
  const union = (x: string, y: string) => {
    const rx = find(x);
    const ry = find(y);
    if (rx !== ry) parent.set(rx, ry);
  };
  for (const p of usable) parent.set(p.id, p.id);

  const pairInfo = new Map<string, PairScore>();
  for (let i = 0; i < usable.length; i++) {
    for (let j = i + 1; j < usable.length; j++) {
      const s = scorePair(usable[i], usable[j]);
      if (!s || !accept(s)) continue;
      union(usable[i].id, usable[j].id);
      pairInfo.set(`${usable[i].id}|${usable[j].id}`, s);
    }
  }

  const groups = new Map<string, SuggestPerson[]>();
  for (const p of usable) {
    const root = find(p.id);
    (groups.get(root) ?? groups.set(root, []).get(root)!).push(p);
  }
  return { groups, rootOf: find, pairInfo };
}

/**
 * Sugerencias de fusión (alta + media confianza) para revisar y confirmar.
 */
export function suggestMerges(people: SuggestPerson[]): MergeSuggestion[] {
  const { groups, rootOf, pairInfo } = groupPeople(people, () => true);
  const suggestions: MergeSuggestion[] = [];
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    const primary = pickPrimary(members);
    const ids = [primary.id, ...members.filter((m) => m.id !== primary.id).map((m) => m.id)];
    let confidence: "alta" | "media" = "alta";
    let reason = "nombres muy parecidos";
    for (const [k, s] of pairInfo) {
      const [x, y] = k.split("|");
      if (rootOf(x) === rootOf(members[0].id)) {
        reason = s.reason;
        if (s.confidence === "media") confidence = "media";
      }
    }
    suggestions.push({ ids, displayName: primary.name, confidence, reason });
  }
  suggestions.sort((a, b) => {
    if (a.confidence !== b.confidence) return a.confidence === "alta" ? -1 : 1;
    return b.ids.length - a.ids.length;
  });
  return suggestions;
}

/**
 * Auto-merge determinista y de BAJO riesgo: agrupa SOLO matches de alta
 * confianza (mismo nombre compacto, contención clara o nombre+apellido). Se
 * aplica sin intervención del usuario para que el informe salga unificado.
 * Devuelve el id de grupo (primario) y el nombre a mostrar por cada persona.
 */
export function autoMergeGroups(
  people: SuggestPerson[],
): { groupId: Map<string, string>; displayName: Map<string, string> } {
  const { groups } = groupPeople(people, (s) => s.confidence === "alta");
  const groupId = new Map<string, string>();
  const displayName = new Map<string, string>();
  for (const members of groups.values()) {
    const primary = pickPrimary(members);
    for (const m of members) {
      groupId.set(m.id, primary.id);
      displayName.set(m.id, primary.name);
    }
  }
  return { groupId, displayName };
}
