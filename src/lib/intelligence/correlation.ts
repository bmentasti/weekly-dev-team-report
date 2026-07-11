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
const KEY_RE = /\b[A-Z][A-Z0-9]{1,9}-\d+\b/g;

/** Extrae claves de ticket de un texto (título, mensaje, branch). */
export function extractTicketKeys(text: string | null | undefined): string[] {
  if (!text) return [];
  const found = text.toUpperCase().match(KEY_RE);
  return found ? Array.from(new Set(found)) : [];
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
function keysOf(s: CorrelationSignal): string[] {
  const keys = new Set<string>();
  for (const k of extractTicketKeys(s.title)) keys.add(k);
  for (const k of extractTicketKeys(s.branch)) keys.add(k);
  // Un work item cuyo externalId ES la clave (Jira DEV-342)
  if (s.kind === "work_item") {
    for (const k of extractTicketKeys(s.externalId)) keys.add(k);
  }
  return Array.from(keys);
}

/**
 * Agrupa signals por trabajo. Cada grupo con clave conocida reúne todos los
 * signals que la referencian. Los signals sin clave quedan como grupos propios.
 */
export function correlate(signals: CorrelationSignal[]): WorkGroup[] {
  const byKey = new Map<string, CorrelationSignal[]>();
  const orphans: CorrelationSignal[] = [];

  for (const s of signals) {
    const keys = keysOf(s);
    if (keys.length === 0) {
      orphans.push(s);
      continue;
    }
    for (const key of keys) {
      const arr = byKey.get(key) ?? [];
      arr.push(s);
      byKey.set(key, arr);
    }
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

  for (const o of orphans) {
    groups.push({ key: null, signals: [o], confidence: 100, evidence: [] });
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
