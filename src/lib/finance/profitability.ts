// Rentabilidad: ganancia y margen actual/proyectado, variación vs objetivo,
// punto de equilibrio y headroom. Separa estrictamente ingreso, costo y margen.

import { isNum, sub, pct, mul, round, abs } from "./money";
import { metric, type MetricResult } from "./types";

/** Ganancia actual = ingreso reconocido − costo real. */
export function currentProfit(args: {
  recognizedRevenue?: number | null;
  actualCost?: number | null;
}): MetricResult {
  const value = sub(args.recognizedRevenue, args.actualCost);
  return metric(value, {
    formula: "currentProfit = recognizedRevenue − actualCost",
    inputs: { recognizedRevenue: args.recognizedRevenue, actualCost: args.actualCost },
    source: "Ingreso reconocido y costo real",
    confidence: value === null ? "NONE" : "HIGH",
  });
}

/** Margen actual % = currentProfit / recognizedRevenue × 100. */
export function currentMarginPct(args: {
  currentProfit?: number | null;
  recognizedRevenue?: number | null;
}): MetricResult {
  const value = pct(args.currentProfit, args.recognizedRevenue);
  return metric(value, {
    formula: "currentMargin% = currentProfit / recognizedRevenue × 100",
    inputs: args,
    source: "Ganancia actual e ingreso reconocido",
    confidence: value === null ? "NONE" : "HIGH",
  });
}

/** Ganancia contractual esperada (baseline) = ingreso contratado − costo baseline. */
export function baselineExpectedProfit(args: {
  contractedRevenue?: number | null;
  baselineEstimatedCost?: number | null;
}): MetricResult {
  const value = sub(args.contractedRevenue, args.baselineEstimatedCost);
  return metric(value, {
    formula: "baselineProfit = contractedRevenue − baselineEstimatedCost",
    inputs: args,
    source: "Baseline original",
    confidence: value === null ? "NONE" : "HIGH",
  });
}

/** Ganancia proyectada = ingreso total proyectado − EAC. */
export function projectedProfit(args: {
  projectedTotalRevenue?: number | null;
  eac?: number | null;
}): MetricResult {
  const value = sub(args.projectedTotalRevenue, args.eac);
  return metric(value, {
    formula: "projectedProfit = projectedTotalRevenue − EAC",
    inputs: args,
    source: "Ingreso total proyectado y EAC",
    confidence: value === null ? "NONE" : "MEDIUM",
  });
}

/** Margen proyectado % = projectedProfit / projectedTotalRevenue × 100. */
export function projectedMarginPct(args: {
  projectedProfit?: number | null;
  projectedTotalRevenue?: number | null;
}): MetricResult {
  const value = pct(args.projectedProfit, args.projectedTotalRevenue);
  return metric(value, {
    formula: "projectedMargin% = projectedProfit / projectedTotalRevenue × 100",
    inputs: args,
    source: "Ganancia proyectada e ingreso proyectado",
    confidence: value === null ? "NONE" : "MEDIUM",
  });
}

/** Pérdida proyectada = |projectedProfit| cuando projectedProfit < 0; si no, 0. */
export function projectedLoss(args: { projectedProfit?: number | null }): MetricResult {
  const p = args.projectedProfit;
  const value = isNum(p) ? (p < 0 ? abs(p) : 0) : null;
  return metric(value, {
    formula: "projectedLoss = |projectedProfit| si projectedProfit < 0, si no 0",
    inputs: args,
    source: "Ganancia proyectada",
    confidence: value === null ? "NONE" : "MEDIUM",
  });
}

/** Variación de margen = margen proyectado − margen objetivo (en puntos %). */
export function marginVariance(args: {
  projectedMarginPct?: number | null;
  targetMarginPct?: number | null;
}): MetricResult {
  const value =
    isNum(args.projectedMarginPct) && isNum(args.targetMarginPct)
      ? round(args.projectedMarginPct - args.targetMarginPct, 2)
      : null;
  return metric(value, {
    formula: "marginVariance = projectedMargin% − targetMargin%",
    inputs: args,
    source: "Margen proyectado y objetivo",
    confidence: value === null ? "NONE" : "MEDIUM",
  });
}

/** Costo máximo antes de entrar en pérdida = ingreso total proyectado. */
export function maximumProfitableCost(args: {
  projectedTotalRevenue?: number | null;
}): MetricResult {
  const value = isNum(args.projectedTotalRevenue) ? round(args.projectedTotalRevenue) : null;
  return metric(value, {
    formula: "maxProfitableCost = projectedTotalRevenue",
    inputs: args,
    source: "Ingreso total proyectado",
    confidence: value === null ? "NONE" : "MEDIUM",
  });
}

/** Costo máximo para mantener el margen objetivo = ingreso × (1 − objetivo%/100). */
export function maximumCostForTargetMargin(args: {
  projectedTotalRevenue?: number | null;
  targetMarginPct?: number | null;
}): MetricResult {
  const value =
    isNum(args.projectedTotalRevenue) && isNum(args.targetMarginPct)
      ? mul(args.projectedTotalRevenue, 1 - args.targetMarginPct / 100)
      : null;
  return metric(value, {
    formula: "maxCostForTargetMargin = projectedTotalRevenue × (1 − targetMargin%/100)",
    inputs: args,
    source: "Ingreso proyectado y margen objetivo",
    confidence: value === null ? "NONE" : "MEDIUM",
  });
}

/** Headroom de rentabilidad = maxProfitableCost − EAC (dinero antes de pérdida). */
export function profitabilityHeadroom(args: {
  maximumProfitableCost?: number | null;
  eac?: number | null;
}): MetricResult {
  const value = sub(args.maximumProfitableCost, args.eac);
  return metric(value, {
    formula: "profitabilityHeadroom = maxProfitableCost − EAC",
    inputs: args,
    source: "Costo máximo rentable y EAC",
    confidence: value === null ? "NONE" : "MEDIUM",
  });
}

/** Headroom de margen objetivo = maxCostForTargetMargin − EAC. */
export function targetMarginHeadroom(args: {
  maximumCostForTargetMargin?: number | null;
  eac?: number | null;
}): MetricResult {
  const value = sub(args.maximumCostForTargetMargin, args.eac);
  return metric(value, {
    formula: "targetMarginHeadroom = maxCostForTargetMargin − EAC",
    inputs: args,
    source: "Costo máximo para margen objetivo y EAC",
    confidence: value === null ? "NONE" : "MEDIUM",
  });
}
