// Orquestador del snapshot financiero. Compone TODAS las métricas a partir de
// insumos planos y las expone con su provenance. Es puro y testeable (sin DB).
// El loader (load.ts) traduce Prisma -> estos insumos.

import { isNum, sumPresent, add } from "./money";
import type { MetricResult, ContractModality, EacMethod, Provenance } from "./types";
import * as B from "./budget";
import * as E from "./evm";
import * as P from "./profitability";
import { financialStatus, type StatusResult } from "./status";
import { incrementalDailyDelayCost, delayedProjectedProfit, breakEvenDelayDays } from "./delay";
import {
  scopeCreep,
  reworkImpact,
  blockerImpact,
  committedPlusActualBlockerCost,
  type ScopeCreepResult,
  type ReworkResult,
  type BlockerImpactResult,
} from "./risks";

export interface EngineInputs {
  modality: ContractModality;
  currency: string;
  asOf: Date;
  // Fechas
  startDate?: Date | null;
  plannedEndDate?: Date | null;
  contractualEndDate?: Date | null;
  forecastEndDate?: Date | null;
  // Presupuesto
  originalBudget?: number | null;
  approvedBudgetIncreases?: number | null;
  approvedBudgetReductions?: number | null;
  bacOverride?: number | null;
  // Costos
  actualCost?: number | null; // AC
  committedCosts?: number | null;
  // Ingresos
  contractedRevenue?: number | null;
  recognizedRevenue?: number | null;
  changeRequestRevenue?: number | null;
  bonuses?: number | null;
  penalties?: number | null;
  penaltiesReduceRevenue?: boolean;
  projectedTotalRevenue?: number | null; // si null se estima
  // Objetivo
  targetMarginPct?: number | null;
  // Avance
  completionPct?: number | null; // % avance físico (combinación ponderada)
  plannedValueOverride?: number | null;
  earnedValueOverride?: number | null;
  // Costo / burn
  burnRatePerDay?: number | null;
  // EAC
  hasBottomUpEtc?: boolean;
  bottomUpEtc?: number | null;
  eacMethodOverride?: EacMethod | null;
  // Baseline
  baselineEstimatedCost?: number | null;
  // Señales de riesgo (para el estado); si no se pasan, se derivan de risks.*
  unapprovedScopeCreep?: boolean;
  significantRework?: boolean;
  hasRecoverableScenario?: boolean;
  // Temporal
  workingDaysPerWeek?: number;
  // ---- Riesgos operativos (Fase 4) ----
  originalScopeValue?: number | null;
  approvedAddedScopeValue?: number | null;
  unapprovedAddedScopeValue?: number | null;
  reworkCost?: number | null;
  totalLaborCost?: number | null;
  blockerActualCost?: number | null;
  blockerCommittedCost?: number | null;
  blockerPotentialCost?: number | null;
  blockerOpportunityCost?: number | null;
}

export interface FinancialSnapshot {
  currency: string;
  asOf: string;
  forecastEndDate: string | null;
  modality: ContractModality;
  budget: {
    currentBudget: MetricResult;
    remainingBudget: MetricResult;
    consumedPct: MetricResult;
    runwayDays: MetricResult;
    exhaustionDate: { date: string | null; insufficientData: boolean; provenance: MetricResult["provenance"] };
  };
  evm: {
    bac: MetricResult;
    pv: MetricResult;
    ev: MetricResult;
    ac: MetricResult;
    cpi: MetricResult;
    spi: MetricResult;
    cv: MetricResult;
    sv: MetricResult;
    eac: MetricResult;
    eacMethod: EacMethod;
    etc: MetricResult;
    vac: MetricResult;
    tcpiBac: MetricResult;
    tcpiEac: MetricResult;
  };
  profitability: {
    currentProfit: MetricResult;
    currentMarginPct: MetricResult;
    baselineExpectedProfit: MetricResult;
    projectedTotalRevenue: MetricResult;
    projectedProfit: MetricResult;
    projectedMarginPct: MetricResult;
    projectedLoss: MetricResult;
    marginVariance: MetricResult;
    profitabilityHeadroom: MetricResult;
    targetMarginHeadroom: MetricResult;
  };
  status: StatusResult;
  /** Alineación avance físico vs. consumo de presupuesto (§ pregunta 6). */
  progressVsSpend: {
    completionPct: number | null;
    consumedPct: number | null;
    aligned: boolean | null;
    note: string;
  };
  /** Rentabilidad temporal: costo de atraso y días absorbibles (§11). */
  temporal: {
    incrementalDailyDelayCost: MetricResult;
    incrementalWeeklyDelayCost: MetricResult;
    breakEvenDelayDays: { value: number | null; note: string; provenance: Provenance };
    zeroMarginDate: string | null;
    marginAtWeeks: { weeks: number; profit: number | null; marginPct: number | null }[];
    workingDaysPerWeek: number;
  };
  /** Riesgos operativos y su impacto económico (§15–17). */
  risks: {
    scopeCreep: ScopeCreepResult;
    rework: ReworkResult;
    blockers: BlockerImpactResult;
    blockerRealCost: number | null;
  };
}

function daysBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000);
}

/** Ingreso total proyectado: usa el explícito o lo estima desde el contrato. */
function deriveProjectedRevenue(i: EngineInputs): number | null {
  if (isNum(i.projectedTotalRevenue)) return i.projectedTotalRevenue;
  if (!isNum(i.contractedRevenue)) return null;
  const cr = isNum(i.changeRequestRevenue) ? i.changeRequestRevenue : 0;
  const bonus = isNum(i.bonuses) ? i.bonuses : 0;
  const penalty = i.penaltiesReduceRevenue && isNum(i.penalties) ? i.penalties : 0;
  return add(i.contractedRevenue, cr, bonus, -penalty);
}

/** Costo proyectado a incorporar penalidad si NO reduce ingreso (va al costo). */
function penaltyToCost(i: EngineInputs): number {
  return !i.penaltiesReduceRevenue && isNum(i.penalties) ? i.penalties : 0;
}

export function computeFinancialSnapshot(i: EngineInputs): FinancialSnapshot {
  // ---- Presupuesto ----
  const currentBudget = B.currentBudget({
    originalBudget: i.originalBudget,
    approvedBudgetIncreases: i.approvedBudgetIncreases,
    approvedBudgetReductions: i.approvedBudgetReductions,
  });
  const remaining = B.remainingBudget({
    currentBudget: currentBudget.value,
    actualCost: i.actualCost,
    committedCosts: i.committedCosts,
  });
  const consumedPct = B.budgetConsumedPct({
    actualCost: i.actualCost,
    currentBudget: currentBudget.value,
  });

  // ---- EVM ----
  const bac = E.bac({ currentBudget: currentBudget.value, override: i.bacOverride });
  const schedulePct = E.plannedSchedulePct({
    startDate: i.startDate,
    plannedEndDate: i.plannedEndDate,
    asOf: i.asOf,
  });
  const pv = E.plannedValue({ bac: bac.value, schedulePct, override: i.plannedValueOverride });
  const ev = E.earnedValue({
    bac: bac.value,
    completionPct: i.completionPct,
    override: i.earnedValueOverride,
  });
  const ac = {
    value: isNum(i.actualCost) ? i.actualCost : null,
    insufficientData: !isNum(i.actualCost),
    provenance: {
      formula: "AC = Σ costos reales imputados (nature=ACTUAL) + penalidades a costo",
      inputs: { actualCost: i.actualCost },
      source: "CostEntry (real)",
      confidence: isNum(i.actualCost) ? ("HIGH" as const) : ("NONE" as const),
    },
  } satisfies MetricResult;
  const cpi = E.cpi({ ev: ev.value, ac: ac.value });
  const spi = E.spi({ ev: ev.value, pv: pv.value });
  const cv = E.costVariance({ ev: ev.value, ac: ac.value });
  const sv = E.scheduleVariance({ ev: ev.value, pv: pv.value });

  const eacMethod =
    i.eacMethodOverride ??
    E.recommendEacMethod({ hasBottomUpEtc: i.hasBottomUpEtc, cpi: cpi.value, spi: spi.value });
  const eac = E.eac({
    method: eacMethod,
    bac: bac.value,
    ac: ac.value,
    ev: ev.value,
    cpi: cpi.value,
    spi: spi.value,
    etc: i.bottomUpEtc,
  });
  const etc = E.etc({ eac: eac.value, ac: ac.value });
  const vac = E.vac({ bac: bac.value, eac: eac.value });
  const tcpiBac = E.tcpi({ bac: bac.value, ev: ev.value, ac: ac.value, base: "BAC" });
  const tcpiEac = E.tcpi({ bac: bac.value, ev: ev.value, ac: ac.value, base: "EAC", eac: eac.value });

  // ---- Rentabilidad ----
  const eacWithPenalty = isNum(eac.value)
    ? sumPresent([eac.value, penaltyToCost(i)])
    : null;
  const currentProfit = P.currentProfit({
    recognizedRevenue: i.recognizedRevenue,
    actualCost: i.actualCost,
  });
  const currentMarginPct = P.currentMarginPct({
    currentProfit: currentProfit.value,
    recognizedRevenue: i.recognizedRevenue,
  });
  const baselineExpectedProfit = P.baselineExpectedProfit({
    contractedRevenue: i.contractedRevenue,
    baselineEstimatedCost: i.baselineEstimatedCost,
  });
  const projRevenueVal = deriveProjectedRevenue(i);
  const projectedTotalRevenue: MetricResult = {
    value: projRevenueVal,
    insufficientData: projRevenueVal === null,
    provenance: {
      formula: "projectedRevenue = contratado + CRs + bonos − penalidades(si aplican a ingreso)",
      inputs: {
        contractedRevenue: i.contractedRevenue,
        changeRequestRevenue: i.changeRequestRevenue,
        bonuses: i.bonuses,
        penalties: i.penalties,
      },
      source: "Config contractual + RevenueEntry",
      confidence: projRevenueVal === null ? "NONE" : "MEDIUM",
    },
  };
  const projectedProfit = P.projectedProfit({
    projectedTotalRevenue: projRevenueVal,
    eac: eacWithPenalty,
  });
  const projectedMarginPct = P.projectedMarginPct({
    projectedProfit: projectedProfit.value,
    projectedTotalRevenue: projRevenueVal,
  });
  const projectedLoss = P.projectedLoss({ projectedProfit: projectedProfit.value });
  const marginVariance = P.marginVariance({
    projectedMarginPct: projectedMarginPct.value,
    targetMarginPct: i.targetMarginPct,
  });
  const maxProfitable = P.maximumProfitableCost({ projectedTotalRevenue: projRevenueVal });
  const maxForTarget = P.maximumCostForTargetMargin({
    projectedTotalRevenue: projRevenueVal,
    targetMarginPct: i.targetMarginPct,
  });
  const profitabilityHeadroom = P.profitabilityHeadroom({
    maximumProfitableCost: maxProfitable.value,
    eac: eacWithPenalty,
  });
  const targetMarginHeadroom = P.targetMarginHeadroom({
    maximumCostForTargetMargin: maxForTarget.value,
    eac: eacWithPenalty,
  });

  // ---- Runway / agotamiento ----
  const runway = B.budgetRunwayDays({
    remainingBudget: remaining.value,
    burnRatePerDay: i.burnRatePerDay,
  });
  const exhaustion = B.budgetExhaustionDate({ asOf: i.asOf, runwayDays: runway.value });

  // ---- Riesgos operativos (§15–17) ----
  const risksScopeCreep = scopeCreep({
    originalScopeValue: i.originalScopeValue,
    approvedAddedValue: i.approvedAddedScopeValue,
    unapprovedAddedValue: i.unapprovedAddedScopeValue,
  });
  const risksRework = reworkImpact({
    reworkCost: i.reworkCost,
    totalLaborCost: i.totalLaborCost,
  });
  const risksBlockers = blockerImpact({
    actualCost: i.blockerActualCost,
    committedCost: i.blockerCommittedCost,
    potentialCost: i.blockerPotentialCost,
    opportunityCost: i.blockerOpportunityCost,
  });
  const blockerRealCost = committedPlusActualBlockerCost(risksBlockers);
  // Flags para el estado: explícitos si vienen, si no se derivan de risks.
  const derivedUnapprovedScopeCreep = i.unapprovedScopeCreep ?? risksScopeCreep.hasUnapprovedCreep;
  const derivedSignificantRework = i.significantRework ?? risksRework.significant;

  // ---- Estado ----
  const daysToForecastEnd =
    i.forecastEndDate ? daysBetween(i.asOf, i.forecastEndDate) : null;
  const forecastEndsAfterContractual =
    i.forecastEndDate && i.contractualEndDate
      ? i.forecastEndDate.getTime() > i.contractualEndDate.getTime()
      : undefined;
  const status = financialStatus({
    projectedProfit: projectedProfit.value,
    projectedMarginPct: projectedMarginPct.value,
    targetMarginPct: i.targetMarginPct,
    eac: eacWithPenalty,
    currentBudget: currentBudget.value,
    cpi: cpi.value,
    spi: spi.value,
    budgetRunwayDays: runway.value,
    daysToForecastEnd: isNum(daysToForecastEnd) ? daysToForecastEnd : null,
    forecastEndsAfterContractual,
    unapprovedScopeCreep: derivedUnapprovedScopeCreep,
    significantRework: derivedSignificantRework,
    hasRecoverableScenario: i.hasRecoverableScenario,
  });

  // ---- Avance vs consumo ----
  const aligned =
    isNum(i.completionPct) && isNum(consumedPct.value)
      ? consumedPct.value <= i.completionPct + 5 // tolerancia 5 puntos
      : null;
  const progressVsSpend = {
    completionPct: isNum(i.completionPct) ? i.completionPct : null,
    consumedPct: consumedPct.value,
    aligned,
    note:
      aligned === null
        ? "Información insuficiente para comparar avance y consumo."
        : aligned
          ? "El consumo de presupuesto acompaña al avance real."
          : "Se consume presupuesto más rápido que el avance generado.",
  };

  // ---- Rentabilidad temporal (§11) ----
  // Proxy del costo diario del equipo: burn rate reciente. Las penalidades son
  // montos puntuales (no diarios), por eso no entran al costo diario acá.
  const wdpw = i.workingDaysPerWeek ?? 5;
  const dailyDelay = incrementalDailyDelayCost({
    dailyTeamCost: i.burnRatePerDay,
    workingDaysPerWeek: wdpw,
  });
  const breakEven = breakEvenDelayDays({
    currentProjectedProfit: projectedProfit.value,
    incrementalDailyDelayCost: dailyDelay.incrementalDailyDelayCost,
  });
  const zeroMarginDate =
    isNum(breakEven.days) && breakEven.days > 0
      ? new Date(i.asOf.getTime() + breakEven.days * 24 * 60 * 60 * 1000).toISOString()
      : null;
  const marginAtWeeks = [1, 2, 4, 8].map((weeks) => {
    const days = weeks * wdpw;
    const profit = delayedProjectedProfit({
      currentProjectedProfit: projectedProfit.value,
      incrementalDailyDelayCost: dailyDelay.incrementalDailyDelayCost,
      delayDays: days,
    });
    const marginPct =
      isNum(profit) && isNum(projRevenueVal) && projRevenueVal !== 0
        ? Math.round((profit / projRevenueVal) * 1000) / 10
        : null;
    return { weeks, profit, marginPct };
  });
  const delayProvenance: Provenance = {
    formula: "dailyDelayCost ≈ burnRate/día; breakEvenDelayDays = projectedProfit / dailyDelayCost",
    inputs: {
      burnRatePerDay: i.burnRatePerDay ?? null,
      projectedProfit: projectedProfit.value,
      workingDaysPerWeek: wdpw,
    },
    source: "Burn rate reciente y ganancia proyectada",
    confidence: dailyDelay.incrementalDailyDelayCost == null ? "NONE" : "MEDIUM",
  };

  return {
    currency: i.currency,
    asOf: i.asOf.toISOString(),
    forecastEndDate: i.forecastEndDate ? i.forecastEndDate.toISOString() : null,
    modality: i.modality,
    budget: {
      currentBudget,
      remainingBudget: remaining,
      consumedPct,
      runwayDays: runway,
      exhaustionDate: {
        date: exhaustion.date ? exhaustion.date.toISOString() : null,
        insufficientData: exhaustion.insufficientData,
        provenance: exhaustion.provenance,
      },
    },
    evm: {
      bac,
      pv,
      ev,
      ac,
      cpi,
      spi,
      cv,
      sv,
      eac,
      eacMethod,
      etc,
      vac,
      tcpiBac,
      tcpiEac,
    },
    profitability: {
      currentProfit,
      currentMarginPct,
      baselineExpectedProfit,
      projectedTotalRevenue,
      projectedProfit,
      projectedMarginPct,
      projectedLoss,
      marginVariance,
      profitabilityHeadroom,
      targetMarginHeadroom,
    },
    status,
    progressVsSpend,
    temporal: {
      incrementalDailyDelayCost: {
        value: dailyDelay.incrementalDailyDelayCost,
        insufficientData: dailyDelay.incrementalDailyDelayCost == null,
        provenance: delayProvenance,
        note: dailyDelay.note,
      },
      incrementalWeeklyDelayCost: {
        value: dailyDelay.incrementalWeeklyDelayCost,
        insufficientData: dailyDelay.incrementalWeeklyDelayCost == null,
        provenance: delayProvenance,
      },
      breakEvenDelayDays: {
        value: breakEven.days,
        note: breakEven.note,
        provenance: delayProvenance,
      },
      zeroMarginDate,
      marginAtWeeks,
      workingDaysPerWeek: wdpw,
    },
    risks: {
      scopeCreep: risksScopeCreep,
      rework: risksRework,
      blockers: risksBlockers,
      blockerRealCost,
    },
  };
}
