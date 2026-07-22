"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { delayedProjectedProfit, earlyCompletionBenefit } from "@/lib/finance";
import type { FinanceLabels } from "./i18n";

export interface SimulatorInputs {
  currency: string;
  modality: string;
  projectedProfit: number | null;
  projectedRevenue: number | null;
  dailyDelayCost: number | null;
  breakEvenDelayDays: number | null;
  workingDaysPerWeek: number;
}

function fmtMoney(v: number | null, currency: string, noData: string): string {
  if (v == null) return noData;
  return `${currency} ${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
function n(v: string): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

export function FinanceSimulator({
  sim,
  labels,
}: {
  sim: SimulatorInputs;
  labels: FinanceLabels;
}) {
  const L = labels;
  const { currency } = sim;

  // ---- Atraso ----
  const [delayDays, setDelayDays] = useState("10");
  const [extraBillable, setExtraBillable] = useState("0");
  const [extraPenalties, setExtraPenalties] = useState("0");

  const delayProfit = delayedProjectedProfit({
    currentProjectedProfit: sim.projectedProfit,
    incrementalDailyDelayCost: sim.dailyDelayCost,
    delayDays: n(delayDays),
    extraBillableRevenue: n(extraBillable),
    extraPenalties: n(extraPenalties),
  });
  const delayCost =
    sim.dailyDelayCost == null ? null : Math.round(sim.dailyDelayCost * n(delayDays));
  const delayMargin =
    delayProfit != null && sim.projectedRevenue && sim.projectedRevenue !== 0
      ? Math.round((delayProfit / sim.projectedRevenue) * 1000) / 10
      : null;

  // ---- Finalización anticipada ----
  const [earlyDays, setEarlyDays] = useState("10");
  const [lostRevenue, setLostRevenue] = useState("0");
  const [bonus, setBonus] = useState("0");
  const [capacityValue, setCapacityValue] = useState("0");
  const [capacityValidated, setCapacityValidated] = useState(false);
  const [transitionCosts, setTransitionCosts] = useState("0");

  const avoidedCost = sim.dailyDelayCost == null ? null : Math.round(sim.dailyDelayCost * n(earlyDays));
  const early = earlyCompletionBenefit({
    plannedRemainingCost: avoidedCost,
    forecastRemainingCost: 0,
    lostRevenue: n(lostRevenue),
    earlyCompletionBonus: n(bonus),
    releasedCapacityValue: n(capacityValue),
    capacityReassignmentValidated: capacityValidated,
    transitionCosts: n(transitionCosts),
  });

  const verdictLabel: Record<string, string> = {
    INCREASES_PROFIT: L.verdict_INCREASES_PROFIT,
    REDUCES_COST_AND_REVENUE: L.verdict_REDUCES_COST_AND_REVENUE,
    IMMATERIAL: L.verdict_IMMATERIAL,
    INSUFFICIENT_DATA: L.verdict_INSUFFICIENT_DATA,
  };
  const verdictVariant =
    early.verdict === "INCREASES_PROFIT"
      ? "success"
      : early.verdict === "REDUCES_COST_AND_REVENUE"
        ? "warning"
        : "secondary";

  const field = "flex flex-col gap-1";
  const noData = L.noData;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{L.simTitle}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-2">
        {/* Atraso */}
        <div className="space-y-3 rounded-input border p-4">
          <p className="text-sm font-semibold">{L.simDelayTitle}</p>
          <div className="grid grid-cols-3 gap-2">
            <div className={field}>
              <Label className="text-xs">{L.delayDaysInput}</Label>
              <Input type="number" min="0" value={delayDays} onChange={(e) => setDelayDays(e.target.value)} />
            </div>
            <div className={field}>
              <Label className="text-xs">{L.extraBillable}</Label>
              <Input type="number" value={extraBillable} onChange={(e) => setExtraBillable(e.target.value)} />
            </div>
            <div className={field}>
              <Label className="text-xs">{L.extraPenalties}</Label>
              <Input type="number" value={extraPenalties} onChange={(e) => setExtraPenalties(e.target.value)} />
            </div>
          </div>
          <dl className="space-y-1 text-sm">
            <Row label={L.delayCostResult} value={fmtMoney(delayCost, currency, noData)} />
            <Row
              label={L.delayedProfitResult}
              value={fmtMoney(delayProfit, currency, noData)}
              accent={delayProfit == null ? undefined : delayProfit >= 0 ? "good" : "bad"}
            />
            <Row
              label={L.delayedMarginResult}
              value={delayMargin == null ? noData : `${delayMargin}%`}
            />
            <Row
              label={L.breakEvenDays}
              value={sim.breakEvenDelayDays == null ? noData : `${sim.breakEvenDelayDays}`}
            />
          </dl>
        </div>

        {/* Finalización anticipada */}
        <div className="space-y-3 rounded-input border p-4">
          <p className="text-sm font-semibold">{L.simEarlyTitle}</p>
          <div className="grid grid-cols-3 gap-2">
            <div className={field}>
              <Label className="text-xs">{L.earlyDaysInput}</Label>
              <Input type="number" min="0" value={earlyDays} onChange={(e) => setEarlyDays(e.target.value)} />
            </div>
            <div className={field}>
              <Label className="text-xs">{L.lostRevenueInput}</Label>
              <Input type="number" value={lostRevenue} onChange={(e) => setLostRevenue(e.target.value)} />
            </div>
            <div className={field}>
              <Label className="text-xs">{L.bonusInput}</Label>
              <Input type="number" value={bonus} onChange={(e) => setBonus(e.target.value)} />
            </div>
            <div className={field}>
              <Label className="text-xs">{L.capacityValueInput}</Label>
              <Input type="number" value={capacityValue} onChange={(e) => setCapacityValue(e.target.value)} />
            </div>
            <div className={field}>
              <Label className="text-xs">{L.transitionCostsInput}</Label>
              <Input type="number" value={transitionCosts} onChange={(e) => setTransitionCosts(e.target.value)} />
            </div>
            <label className="col-span-3 flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={capacityValidated}
                onChange={(e) => setCapacityValidated(e.target.checked)}
              />
              {L.capacityValidated}
            </label>
          </div>
          {sim.modality === "TIME_AND_MATERIALS" && (
            <p className="text-xs text-amber-600">{L.tmEarlyHint}</p>
          )}
          <dl className="space-y-1 text-sm">
            <Row label={L.avoidedCostResult} value={fmtMoney(early.breakdown.avoidedCost, currency, noData)} />
            <Row
              label={L.netBenefitResult}
              value={fmtMoney(early.netBenefit, currency, noData)}
              accent={early.netBenefit == null ? undefined : early.netBenefit >= 0 ? "good" : "bad"}
            />
          </dl>
          <Badge variant={verdictVariant}>{verdictLabel[early.verdict]}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "good" | "bad";
}) {
  const color = accent === "good" ? "text-emerald-600" : accent === "bad" ? "text-red-600" : "";
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`font-semibold tabular-nums ${color}`}>{value}</dd>
    </div>
  );
}
