// Earned Value Management: PV, EV, AC, CPI, SPI, CV, SV, EAC, ETC, VAC, TCPI.
// Cruza avance físico, tiempo y costo. Cada resultado explica su fórmula.

import { isNum, div, sub, mul, round } from "./money";
import { metric, type MetricResult, type EacMethod } from "./types";

/** Budget At Completion: presupuesto aprobado para completar el proyecto. */
export function bac(args: { currentBudget?: number | null; override?: number | null }): MetricResult {
  const value = isNum(args.override) ? args.override : args.currentBudget ?? null;
  return metric(isNum(value) ? round(value) : null, {
    formula: "BAC = presupuesto aprobado a completar (currentBudget u override)",
    inputs: { currentBudget: args.currentBudget, override: args.override },
    source: "Presupuesto vigente",
    confidence: isNum(value) ? "HIGH" : "NONE",
  });
}

/**
 * Fracción planificada de cronograma (0..1) por tiempo transcurrido.
 * plannedSchedulePct = elapsed / totalDuration, acotado a [0,1].
 */
export function plannedSchedulePct(args: {
  startDate?: Date | null;
  plannedEndDate?: Date | null;
  asOf: Date;
}): number | null {
  const { startDate, plannedEndDate, asOf } = args;
  if (!startDate || !plannedEndDate) return null;
  const total = plannedEndDate.getTime() - startDate.getTime();
  if (total <= 0) return null;
  const elapsed = asOf.getTime() - startDate.getTime();
  const frac = elapsed / total;
  return round(Math.min(1, Math.max(0, frac)), 6);
}

/** Planned Value = BAC × %cronograma planificado (o override). */
export function plannedValue(args: {
  bac?: number | null;
  schedulePct?: number | null; // 0..1
  override?: number | null;
}): MetricResult {
  const value = isNum(args.override)
    ? round(args.override)
    : mul(args.bac, args.schedulePct);
  return metric(value, {
    formula: "PV = BAC × %cronograma_planificado",
    inputs: { bac: args.bac, schedulePct: args.schedulePct, override: args.override },
    source: "BAC y avance planificado por tiempo",
    confidence: value === null ? "NONE" : "MEDIUM",
  });
}

/** Earned Value = BAC × %avance físico real (o override). */
export function earnedValue(args: {
  bac?: number | null;
  completionPct?: number | null; // 0..100
  override?: number | null;
}): MetricResult {
  const frac = isNum(args.completionPct) ? args.completionPct / 100 : null;
  const value = isNum(args.override) ? round(args.override) : mul(args.bac, frac);
  return metric(value, {
    formula: "EV = BAC × (%avance_real / 100)",
    inputs: { bac: args.bac, completionPct: args.completionPct, override: args.override },
    source: "BAC y avance físico (combinación ponderada)",
    confidence: value === null ? "NONE" : "MEDIUM",
  });
}

/** Cost Performance Index = EV / AC. >1 eficiente, <1 gasta más valor del que genera. */
export function cpi(args: { ev?: number | null; ac?: number | null }): MetricResult {
  const value = div(args.ev, args.ac, 4);
  return metric(value, {
    formula: "CPI = EV / AC",
    inputs: { ev: args.ev, ac: args.ac },
    source: "Earned Value y costo real",
    confidence: value === null ? "NONE" : "HIGH",
  });
}

/** Schedule Performance Index = EV / PV. >1 adelantado, <1 atrasado. */
export function spi(args: { ev?: number | null; pv?: number | null }): MetricResult {
  const value = div(args.ev, args.pv, 4);
  return metric(value, {
    formula: "SPI = EV / PV",
    inputs: { ev: args.ev, pv: args.pv },
    source: "Earned Value y Planned Value",
    confidence: value === null ? "NONE" : "MEDIUM",
  });
}

/** Cost Variance = EV − AC. */
export function costVariance(args: { ev?: number | null; ac?: number | null }): MetricResult {
  const value = sub(args.ev, args.ac);
  return metric(value, {
    formula: "CV = EV − AC",
    inputs: { ev: args.ev, ac: args.ac },
    source: "Earned Value y costo real",
    confidence: value === null ? "NONE" : "HIGH",
  });
}

/** Schedule Variance = EV − PV. */
export function scheduleVariance(args: { ev?: number | null; pv?: number | null }): MetricResult {
  const value = sub(args.ev, args.pv);
  return metric(value, {
    formula: "SV = EV − PV",
    inputs: { ev: args.ev, pv: args.pv },
    source: "Earned Value y Planned Value",
    confidence: value === null ? "NONE" : "MEDIUM",
  });
}

/**
 * Estimate At Completion. 4 modelos; se explicita cuál se usa.
 *  - cost:          BAC / CPI                          (desvío de costo continúa)
 *  - cost_schedule: AC + (BAC − EV) / (CPI × SPI)      (costo y cronograma)
 *  - bottom_up:     AC + ETC re-estimado a mano
 *  - simple:        AC + ETC provisto
 */
export function eac(args: {
  method: EacMethod;
  bac?: number | null;
  ac?: number | null;
  ev?: number | null;
  cpi?: number | null;
  spi?: number | null;
  etc?: number | null; // para bottom_up / simple
}): MetricResult {
  const { method, bac: b, ac, ev, cpi: c, spi: s, etc } = args;
  let value: number | null = null;
  let formula = "";
  switch (method) {
    case "cost":
      value = isNum(b) && isNum(c) && c !== 0 ? round(b / c) : null;
      formula = "EAC = BAC / CPI";
      break;
    case "cost_schedule":
      value =
        isNum(ac) && isNum(b) && isNum(ev) && isNum(c) && isNum(s) && c * s !== 0
          ? round(ac + (b - ev) / (c * s))
          : null;
      formula = "EAC = AC + (BAC − EV) / (CPI × SPI)";
      break;
    case "bottom_up":
    case "simple":
      value = isNum(ac) && isNum(etc) ? round(ac + etc) : null;
      formula = method === "bottom_up" ? "EAC = AC + ETC(re-estimado detallado)" : "EAC = AC + ETC";
      break;
  }
  return metric(value, {
    formula,
    inputs: { method, bac: b, ac, ev, cpi: c, spi: s, etc },
    source: "Modelo EAC seleccionado según calidad de datos",
    confidence: value === null ? "NONE" : method === "cost_schedule" ? "MEDIUM" : "MEDIUM",
  });
}

/**
 * Recomienda un método de EAC según la información disponible:
 *  - Si hay ETC bottom-up confiable -> bottom_up.
 *  - Si el atraso importa (SPI disponible y ≠ 1) -> cost_schedule.
 *  - Si sólo hay CPI -> cost.
 */
export function recommendEacMethod(args: {
  hasBottomUpEtc?: boolean;
  cpi?: number | null;
  spi?: number | null;
}): EacMethod {
  if (args.hasBottomUpEtc) return "bottom_up";
  if (isNum(args.cpi) && isNum(args.spi)) return "cost_schedule";
  if (isNum(args.cpi)) return "cost";
  return "simple";
}

/** Estimate To Complete = EAC − AC. */
export function etc(args: { eac?: number | null; ac?: number | null }): MetricResult {
  const value = sub(args.eac, args.ac);
  return metric(value, {
    formula: "ETC = EAC − AC",
    inputs: { eac: args.eac, ac: args.ac },
    source: "EAC y costo real",
    confidence: value === null ? "NONE" : "MEDIUM",
  });
}

/** Variance At Completion = BAC − EAC. Positivo: ahorro; negativo: sobrecosto. */
export function vac(args: { bac?: number | null; eac?: number | null }): MetricResult {
  const value = sub(args.bac, args.eac);
  return metric(value, {
    formula: "VAC = BAC − EAC",
    inputs: { bac: args.bac, eac: args.eac },
    source: "BAC y EAC",
    confidence: value === null ? "NONE" : "MEDIUM",
  });
}

/**
 * To Complete Performance Index. Eficiencia requerida para cerrar dentro del
 * presupuesto (base BAC) o dentro del EAC. Se interpreta su realismo.
 */
export function tcpi(args: {
  bac?: number | null;
  ev?: number | null;
  ac?: number | null;
  base: "BAC" | "EAC";
  eac?: number | null;
}): MetricResult {
  const { bac: b, ev, ac, base, eac: e } = args;
  const denom = base === "BAC" ? sub(b, ac) : sub(e, ac);
  const value =
    isNum(b) && isNum(ev) && isNum(denom) && denom !== 0 ? round((b - ev) / denom, 4) : null;
  let note: string | undefined;
  if (isNum(value)) {
    if (value > 1.1) note = "Eficiencia requerida > 1.10: difícilmente realista.";
    else if (value > 1) note = "Requiere mejorar la eficiencia respecto a la histórica.";
  }
  return metric(
    value,
    {
      formula: base === "BAC" ? "TCPI = (BAC − EV) / (BAC − AC)" : "TCPI = (BAC − EV) / (EAC − AC)",
      inputs: { bac: b, ev, ac, eac: e, base },
      source: "EVM",
      confidence: value === null ? "NONE" : "MEDIUM",
    },
    note,
  );
}
