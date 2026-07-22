// Riesgos operativos y su impacto económico (§15 scope creep, §16 retrabajo,
// §17 bloqueos). Funciones puras. Reglas clave:
//  - Separar crecimiento de alcance APROBADO (contractual) del NO aprobado.
//  - No atribuir todo aumento de costo a baja productividad (§15).
//  - No mostrar estimaciones/potenciales como si fueran montos reales (§17).

import { isNum, pct, round, sumPresent } from "./money";
import type { Provenance } from "./types";

// ---------------------------------------------------------------------------
// Scope creep (§15)
// ---------------------------------------------------------------------------

export interface ScopeCreepResult {
  growthPct: number | null; // (aprobado + no aprobado) / original × 100
  approvedGrowthPct: number | null;
  unapprovedGrowthPct: number | null;
  approvedValue: number | null;
  unapprovedValue: number | null;
  /** true si hay alcance agregado sin aprobación presupuestaria. */
  hasUnapprovedCreep: boolean;
  insufficientData: boolean;
  provenance: Provenance;
  note: string;
}

export function scopeCreep(args: {
  originalScopeValue?: number | null;
  approvedAddedValue?: number | null;
  unapprovedAddedValue?: number | null;
}): ScopeCreepResult {
  const original = args.originalScopeValue;
  const approved = isNum(args.approvedAddedValue) ? args.approvedAddedValue : 0;
  const unapproved = isNum(args.unapprovedAddedValue) ? args.unapprovedAddedValue : 0;
  const total = approved + unapproved;

  const growthPct = pct(total, original);
  const approvedGrowthPct = pct(approved, original);
  const unapprovedGrowthPct = pct(unapproved, original);
  const insufficient = !isNum(original) || original === 0;

  const provenance: Provenance = {
    formula: "scopeGrowth% = (aprobado + no aprobado) / alcanceOriginal × 100",
    inputs: { originalScopeValue: original, approvedAddedValue: approved, unapprovedAddedValue: unapproved },
    source: "Baseline (alcance) + cambios de alcance / change requests",
    confidence: insufficient ? "NONE" : "MEDIUM",
  };

  let note: string;
  if (insufficient) note = "Falta el valor de alcance original: no se puede medir el crecimiento.";
  else if (unapproved > 0)
    note = "Hay alcance agregado SIN aprobación presupuestaria: separar de la desviación negativa (§15).";
  else note = "El crecimiento de alcance está respaldado por aprobaciones.";

  return {
    growthPct,
    approvedGrowthPct,
    unapprovedGrowthPct,
    approvedValue: isNum(args.approvedAddedValue) ? round(approved) : null,
    unapprovedValue: isNum(args.unapprovedAddedValue) ? round(unapproved) : null,
    hasUnapprovedCreep: unapproved > 0,
    insufficientData: insufficient,
    provenance,
    note,
  };
}

// ---------------------------------------------------------------------------
// Retrabajo (§16)
// ---------------------------------------------------------------------------

export interface ReworkResult {
  cost: number | null;
  /** % del costo laboral total representado por retrabajo. */
  reworkPct: number | null;
  /** true si el retrabajo supera el umbral configurado (default 10%). */
  significant: boolean;
  insufficientData: boolean;
  provenance: Provenance;
  note: string;
}

export function reworkImpact(args: {
  reworkCost?: number | null;
  totalLaborCost?: number | null; // costo laboral incluyendo el retrabajo
  significantThresholdPct?: number; // default 10
}): ReworkResult {
  const threshold = args.significantThresholdPct ?? 10;
  const reworkPct = pct(args.reworkCost, args.totalLaborCost);
  const insufficient = !isNum(args.reworkCost) || !isNum(args.totalLaborCost) || args.totalLaborCost === 0;
  const significant = isNum(reworkPct) && reworkPct >= threshold;
  return {
    cost: isNum(args.reworkCost) ? round(args.reworkCost) : null,
    reworkPct,
    significant,
    insufficientData: insufficient,
    provenance: {
      formula: "rework% = costoRetrabajo / costoLaboralTotal × 100",
      inputs: { reworkCost: args.reworkCost, totalLaborCost: args.totalLaborCost, threshold },
      source: "CostEntry (categoría REWORK y LABOR)",
      confidence: insufficient ? "NONE" : "MEDIUM",
    },
    note: insufficient
      ? "No hay costo de retrabajo o laboral registrado."
      : significant
        ? `Retrabajo relevante: ≥ ${threshold}% del costo laboral.`
        : "Retrabajo dentro de un rango tolerable.",
  };
}

// ---------------------------------------------------------------------------
// Bloqueos (§17) — separar naturaleza; nunca mezclar potencial con real
// ---------------------------------------------------------------------------

export interface BlockerImpactResult {
  actualCost: number | null; // registrado (nature=ACTUAL)
  committedCost: number | null; // comprometido
  potentialCost: number | null; // estimado (NO es un monto real)
  opportunityCost: number | null; // costo de oportunidad
  insufficientData: boolean;
  provenance: Provenance;
  note: string;
}

export function blockerImpact(args: {
  actualCost?: number | null;
  committedCost?: number | null;
  potentialCost?: number | null;
  opportunityCost?: number | null;
}): BlockerImpactResult {
  const any =
    isNum(args.actualCost) || isNum(args.committedCost) || isNum(args.potentialCost) || isNum(args.opportunityCost);
  return {
    actualCost: isNum(args.actualCost) ? round(args.actualCost) : null,
    committedCost: isNum(args.committedCost) ? round(args.committedCost) : null,
    potentialCost: isNum(args.potentialCost) ? round(args.potentialCost) : null,
    opportunityCost: isNum(args.opportunityCost) ? round(args.opportunityCost) : null,
    insufficientData: !any,
    provenance: {
      formula: "Costo de bloqueos agregado por naturaleza (real / comprometido / potencial / oportunidad)",
      inputs: { ...args },
      source: "CostEntry (categoría BLOCKER)",
      confidence: any ? "MEDIUM" : "NONE",
    },
    note: any
      ? "El costo potencial y el de oportunidad son estimaciones: no se suman al costo real."
      : "Sin costos de bloqueo registrados.",
  };
}

/** Suma sólo lo que es imputable como costo REAL a hoy (real + comprometido). */
export function committedPlusActualBlockerCost(r: BlockerImpactResult): number | null {
  if (r.insufficientData) return null;
  return sumPresent([r.actualCost, r.committedCost]);
}
