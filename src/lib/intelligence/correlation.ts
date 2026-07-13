// Motor de correlación / deduplicación (Etapa 2).
// Vincula registros de distintas herramientas que pertenecen al mismo trabajo.
// Ej: Jira DEV-342 + branch feature/DEV-342 + PR "Fix ... DEV-342" + Slack + Sentry.
import type {
  UnifiedWorkItem,
  UnifiedCodeChange,
  ActivitySignal,
  WorkItemBucket,
  CodeChangeState,
} from "@/lib/integrations/types";

export type SignalKind = "work_item" | "code_change" | "activity";
export type EvidenceKind = "ticket_key" | "branch" | "cross_reference" | "manual";

export interface CorrelationSignal {
  kind: SignalKind;
  source: string; // provider slug
  externalId: string;
  title: string;
  url: string;
  branch?: string | null;
  bucket?: WorkItemBucket; // work_item
  codeState?: CodeChangeState; // code_change
  hasReviewer?: boolean;
  checksFailing?: boolean;
}

export interface WorkGroup {
  /** Clave canónica del trabajo (ej. "DEV-342"), si se detectó. */
  key: string | null;
  signals: CorrelationSignal[];
  /** Confianza de que los signals son el mismo trabajo (0..100). */
  confidence: number;
  evidence: EvidenceKind[];
  /** Vínculo confirmado manualmente: no debe ser reemplazado automáticamente. */
  locked?: boolean;
}

// Clave de ticket tipo ABC-123 / DEV-342.
// IMPORTANTE: NO se uppercasea el texto; matcheamos claves que YA están en
// mayúsculas en el original. Así "node-18" no matchea, pero "DEV-123" sí.
const KEY_RE = /\b[A-Z][A-Z0-9]{1,9}-\d+\b/g;

/**
 * Extrae claves de ticket de un texto (título, mensaje, branch).
 * Sólo reconoce prefijos ya escritos en MAYÚSCULAS (evita falsos positivos
 * como "node-18" → "NODE-18").
 * @param knownProjectKeys prefijos conocidos (ej. ["DEV", "OPS"]); si se pasa,
 *   se filtran las claves a esos prefijos. Si no, se usa el patrón estricto.
 */
export function extractTicketKeys(
  text: string | null | undefined,
  knownProjectKeys?: string[],
): string[] {
  if (!text) return [];
  const found = text.match(KEY_RE);
  if (!found) return [];
  let keys = Array.from(new Set(found));
  if (knownProjectKeys && knownProjectKeys.length > 0) {
    const allowed = new Set(knownProjectKeys.map((k) => k.toUpperCase()));
    keys = keys.filter((k) => allowed.has(k.split("-")[0]));
  }
  return keys;
}

// --- Mappers desde los tipos unificados existentes -------------------------
export function fromWorkItem(w: UnifiedWorkItem): CorrelationSignal {
  return {
    kind: "work_item",
    source: w.source,
    externalId: w.externalId,
    title: w.title,
    url: w.url,
    bucket: w.bucket,
  };
}

export function fromCodeChange(c: UnifiedCodeChange): CorrelationSignal {
  return {
    kind: "code_change",
    source: c.source,
    externalId: c.externalId,
    title: c.title,
    url: c.url,
    codeState: c.state,
    hasReviewer: c.hasReviewer,
    checksFailing: c.checksState === "failure",
  };
}

export function fromActivity(a: ActivitySignal): CorrelationSignal {
  return {
    kind: "activity",
    source: a.source,
    externalId: a.externalId,
    title: a.text,
    url: a.url ?? "",
  };
}

/** Claves candidatas de un signal (de su título, y de su externalId si es una clave). */
function keysOf(s: CorrelationSignal, knownProjectKeys?: string[]): string[] {
  const keys = new Set<string>();
  for (const k of extractTicketKeys(s.title, knownProjectKeys)) keys.add(k);
  for (const k of extractTicketKeys(s.branch, knownProjectKeys)) keys.add(k);
  // Un work item cuyo externalId ES la clave (Jira DEV-342)
  if (s.kind === "work_item") {
    for (const k of extractTicketKeys(s.externalId, knownProjectKeys)) keys.add(k);
  }
  return Array.from(keys);
}

/**
 * Clave canónica de un signal: si es work_item y su externalId es una clave,
 * se prefiere esa; si no, la primera clave detectada en título/branch.
 * Cada signal se asigna a UNA sola key (evita doble conteo entre grupos).
 */
function canonicalKeyOf(s: CorrelationSignal, knownProjectKeys?: string[]): string | null {
  if (s.kind === "work_item") {
    const fromId = extractTicketKeys(s.externalId, knownProjectKeys);
    if (fromId.length > 0) return fromId[0];
  }
  const keys = keysOf(s, knownProjectKeys);
  return keys.length > 0 ? keys[0] : null;
}

/**
 * Agrupa signals por trabajo. Cada grupo con clave conocida reúne todos los
 * signals que la referencian. Los signals sin clave quedan como grupos propios.
 * Cada signal se asigna a UNA sola key canónica (sin doble conteo).
 * @param knownProjectKeys prefijos de proyecto conocidos, opcional (ver extractTicketKeys).
 */
export function correlate(
  signals: CorrelationSignal[],
  knownProjectKeys?: string[],
): WorkGroup[] {
  const byKey = new Map<string, CorrelationSignal[]>();
  const orphans: CorrelationSignal[] = [];

  for (const s of signals) {
    const key = canonicalKeyOf(s, knownProjectKeys);
    if (key === null) {
      orphans.push(s);
      continue;
    }
    const arr = byKey.get(key) ?? [];
    arr.push(s);
    byKey.set(key, arr);
  }

  const groups: WorkGroup[] = [];
  for (const [key, sigs] of byKey) {
    const anchor = sigs.find(
      (s) => s.kind === "work_item" && extractTicketKeys(s.externalId).includes(key),
    );
    const evidence = new Set<EvidenceKind>();
    if (anchor) evidence.add("ticket_key");
    if (sigs.some((s) => extractTicketKeys(s.branch).includes(key))) evidence.add("branch");
    if (sigs.some((s) => s.kind !== "work_item")) evidence.add("cross_reference");

    // Confianza: anclada a un work item real + referencias cruzadas = alta.
    let confidence = 60;
    if (anchor) confidence += 25;
    if (evidence.has("branch")) confidence += 8;
    if (sigs.length >= 3) confidence += 7;
    confidence = Math.min(confidence, 98);

    groups.push({
      key,
      signals: dedupe(sigs),
      confidence,
      evidence: Array.from(evidence),
    });
  }

  // Orphans: señales sin correlación. Confianza MODERADA (no 100): representa
  // una única señal sin corroboración cruzada, no una certeza.
  const ORPHAN_CONFIDENCE = 40;
  for (const o of orphans) {
    groups.push({ key: null, signals: [o], confidence: ORPHAN_CONFIDENCE, evidence: [] });
  }
  return groups;
}

function dedupe(sigs: CorrelationSignal[]): CorrelationSignal[] {
  const seen = new Set<string>();
  const out: CorrelationSignal[] = [];
  for (const s of sigs) {
    const id = `${s.kind}:${s.source}:${s.externalId}`;
    if (!seen.has(id)) {
      seen.add(id);
      out.push(s);
    }
  }
  return out;
}
