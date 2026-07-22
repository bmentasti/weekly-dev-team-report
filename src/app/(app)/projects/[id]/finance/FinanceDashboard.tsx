"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CHART, axisProps, gridProps, ChartTooltip } from "@/components/charts/chart-theme";
import type { FinancialSnapshot } from "@/lib/finance/engine";
import type { MetricResult, FinancialStatus } from "@/lib/finance/types";
import type { FinanceLabels } from "./i18n";

function statusMeta(
  status: FinancialStatus,
  L: FinanceLabels,
): { label: string; variant: "success" | "warning" | "destructive" | "info" | "secondary" } {
  switch (status) {
    case "HEALTHY":
      return { label: L.status_HEALTHY, variant: "success" };
    case "ATTENTION":
      return { label: L.status_ATTENTION, variant: "warning" };
    case "AT_RISK":
      return { label: L.status_AT_RISK, variant: "destructive" };
    case "CRITICAL":
      return { label: L.status_CRITICAL, variant: "destructive" };
    default:
      return { label: L.status_INSUFFICIENT_DATA, variant: "secondary" };
  }
}

function opsHealthVariant(h: string): "success" | "warning" | "destructive" | "secondary" {
  if (h === "HEALTHY") return "success";
  if (h === "MEDIUM_RISK") return "warning";
  if (h === "HIGH_RISK") return "destructive";
  return "secondary";
}
function opsHealthLabel(h: string, L: FinanceLabels): string {
  if (h === "HEALTHY") return L.ops_HEALTHY;
  if (h === "MEDIUM_RISK") return L.ops_MEDIUM_RISK;
  if (h === "HIGH_RISK") return L.ops_HIGH_RISK;
  return h;
}

function fmtMoney(v: number | null, currency: string, L: FinanceLabels): string {
  if (v == null) return L.noData;
  return `${currency} ${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
function fmtNum(v: number | null, L: FinanceLabels, dp = 2): string {
  if (v == null) return L.noData;
  return v.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
}
function fmtPct(v: number | null, L: FinanceLabels): string {
  if (v == null) return L.noData;
  return `${v.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
}
function fmtDate(iso: string | null, L: FinanceLabels): string {
  if (!iso) return L.noData;
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

/** Tarjeta de KPI con valor + fórmula/fuente (trazabilidad §21). */
function Kpi({
  label,
  value,
  metric,
  accent,
  L,
}: {
  label: string;
  value: string;
  metric?: MetricResult;
  accent?: "good" | "bad" | "warn";
  L: FinanceLabels;
}) {
  const [open, setOpen] = useState(false);
  const color =
    accent === "good"
      ? "text-emerald-600"
      : accent === "bad"
        ? "text-red-600"
        : accent === "warn"
          ? "text-amber-600"
          : "text-foreground";
  return (
    <div className="rounded-input border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {metric && (
          <button
            onClick={() => setOpen((o) => !o)}
            className="text-[10px] text-muted-foreground underline decoration-dotted"
          >
            {L.formula}
          </button>
        )}
      </div>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${color}`}>{value}</p>
      {metric && open && (
        <div className="mt-2 space-y-1 border-t pt-2 text-[11px] text-muted-foreground">
          <p className="font-mono">{metric.provenance.formula}</p>
          <p>
            {L.source}: {metric.provenance.source}
          </p>
          <p>
            {L.confidence}: {metric.provenance.confidence}
          </p>
          {metric.note && <p className="italic">{metric.note}</p>}
        </div>
      )}
    </div>
  );
}

export function FinanceDashboard({
  snapshot,
  canViewMargins,
  projectName,
  projectId,
  canExport,
  operationalHealth,
  reportId,
  labels,
}: {
  snapshot: FinancialSnapshot;
  canViewMargins: boolean;
  projectName: string;
  projectId: string;
  canExport: boolean;
  operationalHealth?: string | null;
  reportId?: string | null;
  labels: FinanceLabels;
}) {
  const L = labels;
  const { budget, evm, profitability, progressVsSpend, status, currency } = snapshot;
  const st = statusMeta(status.status, L);

  const evmData = [
    { name: L.pv, value: evm.pv.value ?? 0, color: CHART.gray },
    { name: L.ev, value: evm.ev.value ?? 0, color: CHART.blue },
    { name: L.ac, value: evm.ac.value ?? 0, color: CHART.navy },
  ];
  const progressData = [
    { name: L.realProgress, value: progressVsSpend.completionPct ?? 0, color: CHART.green },
    { name: L.budgetConsumed, value: progressVsSpend.consumedPct ?? 0, color: CHART.amber },
  ];

  const marginAccent = (v: number | null, target: number | null) =>
    v == null ? undefined : target != null && v < target ? "warn" : v < 0 ? "bad" : "good";

  return (
    <div className="space-y-6">
      {/* Encabezado + estado */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{L.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {projectName} · {L.modality}: {snapshot.modality.replaceAll("_", " ")} · {L.asOf}:{" "}
            {fmtDate(snapshot.asOf, L)}
          </p>
        </div>
        <div className="text-right">
          <div className="flex items-center justify-end gap-2">
            {operationalHealth && (
              <Link href={reportId ? `/reports/${reportId}` : "/reports"}>
                <Badge variant={opsHealthVariant(operationalHealth)} title={L.opsHealthLabel}>
                  {L.opsHealthLabel}: {opsHealthLabel(operationalHealth, L)}
                </Badge>
              </Link>
            )}
            <Badge variant={st.variant} className="text-sm">
              {st.label}
            </Badge>
          </div>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">{status.explanation}</p>
          {canExport && (
            <a
              href={`/api/projects/${projectId}/finance/export`}
              className="mt-2 inline-block text-xs text-primary underline"
            >
              {L.exportCsv}
            </a>
          )}
        </div>
      </div>

      {/* Fila 1: ingresos / presupuesto / costo */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={L.currentBudget} value={fmtMoney(budget.currentBudget.value, currency, L)} metric={budget.currentBudget} L={L} />
        <Kpi label={L.actualCost} value={fmtMoney(evm.ac.value, currency, L)} metric={evm.ac} L={L} />
        <Kpi
          label={L.remainingBudget}
          value={fmtMoney(budget.remainingBudget.value, currency, L)}
          metric={budget.remainingBudget}
          accent={budget.remainingBudget.value != null && budget.remainingBudget.value < 0 ? "bad" : undefined}
          L={L}
        />
        <Kpi label={L.consumedPct} value={fmtPct(budget.consumedPct.value, L)} metric={budget.consumedPct} L={L} />
      </div>

      {/* Fila 2: EVM índices */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label={L.cpi}
          value={fmtNum(evm.cpi.value, L)}
          metric={evm.cpi}
          accent={evm.cpi.value == null ? undefined : evm.cpi.value >= 1 ? "good" : "bad"}
          L={L}
        />
        <Kpi
          label={L.spi}
          value={fmtNum(evm.spi.value, L)}
          metric={evm.spi}
          accent={evm.spi.value == null ? undefined : evm.spi.value >= 1 ? "good" : "warn"}
          L={L}
        />
        <Kpi label={`${L.eac} (${evm.eacMethod})`} value={fmtMoney(evm.eac.value, currency, L)} metric={evm.eac} L={L} />
        <Kpi label={L.etc} value={fmtMoney(evm.etc.value, currency, L)} metric={evm.etc} L={L} />
      </div>

      {/* Fila 3: VAC / TCPI / runway */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label={L.vac}
          value={fmtMoney(evm.vac.value, currency, L)}
          metric={evm.vac}
          accent={evm.vac.value == null ? undefined : evm.vac.value >= 0 ? "good" : "bad"}
          L={L}
        />
        <Kpi
          label={L.tcpi}
          value={fmtNum(evm.tcpiBac.value, L)}
          metric={evm.tcpiBac}
          accent={evm.tcpiBac.value == null ? undefined : evm.tcpiBac.value > 1.1 ? "bad" : "good"}
          L={L}
        />
        <Kpi label={L.runway} value={fmtNum(budget.runwayDays.value, L, 0)} metric={budget.runwayDays} L={L} />
        <Kpi label={L.exhaustionDate} value={fmtDate(budget.exhaustionDate.date, L)} L={L} />
      </div>

      {/* Fila 4: rentabilidad (sólo con viewMargins) */}
      {canViewMargins ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi
            label={L.projectedProfit}
            value={fmtMoney(profitability.projectedProfit.value, currency, L)}
            metric={profitability.projectedProfit}
            accent={
              profitability.projectedProfit.value == null
                ? undefined
                : profitability.projectedProfit.value >= 0
                  ? "good"
                  : "bad"
            }
            L={L}
          />
          <Kpi
            label={L.projectedMargin}
            value={fmtPct(profitability.projectedMarginPct.value, L)}
            metric={profitability.projectedMarginPct}
            accent={marginAccent(
              profitability.projectedMarginPct.value,
              profitability.marginVariance.provenance.inputs.targetMarginPct as number | null,
            )}
            L={L}
          />
          <Kpi
            label={L.currentProfit}
            value={fmtMoney(profitability.currentProfit.value, currency, L)}
            metric={profitability.currentProfit}
            L={L}
          />
          <Kpi
            label={L.marginVsTarget}
            value={
              profitability.marginVariance.value == null
                ? L.noData
                : `${profitability.marginVariance.value > 0 ? "+" : ""}${fmtNum(profitability.marginVariance.value, L, 1)} ${L.points}`
            }
            metric={profitability.marginVariance}
            accent={
              profitability.marginVariance.value == null
                ? undefined
                : profitability.marginVariance.value >= 0
                  ? "good"
                  : "warn"
            }
            L={L}
          />
        </div>
      ) : (
        <Card>
          <CardContent className="py-4 text-sm text-muted-foreground">{L.marginsRestricted}</CardContent>
        </Card>
      )}

      {/* Gráficos */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{L.evmTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={evmData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="name" {...axisProps} interval={0} tick={{ fontSize: 10, fill: CHART.axis }} />
                  <YAxis {...axisProps} />
                  <Tooltip content={<ChartTooltip suffix={` ${currency}`} />} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {evmData.map((d, idx) => (
                      <Cell key={idx} fill={d.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              CV = EV − AC: {fmtMoney(evm.cv.value, currency, L)} · SV = EV − PV: {fmtMoney(evm.sv.value, currency, L)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{L.progressVsSpendTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={progressData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="name" {...axisProps} interval={0} tick={{ fontSize: 10, fill: CHART.axis }} />
                  <YAxis {...axisProps} domain={[0, 100]} unit="%" />
                  <Tooltip content={<ChartTooltip suffix="%" />} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {progressData.map((d, idx) => (
                      <Cell key={idx} fill={d.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p
              className={`mt-2 text-xs ${
                progressVsSpend.aligned === false ? "text-amber-600" : "text-muted-foreground"
              }`}
            >
              {progressVsSpend.note}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Rentabilidad temporal (§11) — sensible: sólo con viewMargins */}
      {canViewMargins && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{L.temporalTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              <Kpi
                label={L.breakEvenDays}
                value={fmtNum(snapshot.temporal.breakEvenDelayDays.value, L, 0)}
                metric={{
                  value: snapshot.temporal.breakEvenDelayDays.value,
                  insufficientData: snapshot.temporal.breakEvenDelayDays.value == null,
                  provenance: snapshot.temporal.breakEvenDelayDays.provenance,
                  note: snapshot.temporal.breakEvenDelayDays.note,
                }}
                L={L}
              />
              <Kpi
                label={L.weeklyDelayCost}
                value={fmtMoney(snapshot.temporal.incrementalWeeklyDelayCost.value, currency, L)}
                metric={snapshot.temporal.incrementalWeeklyDelayCost}
                L={L}
              />
              <Kpi label={L.zeroMarginDate} value={fmtDate(snapshot.temporal.zeroMarginDate, L)} L={L} />
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">{L.marginByWeeks}</p>
              <div className="grid grid-cols-4 gap-2">
                {snapshot.temporal.marginAtWeeks.map((w) => (
                  <div key={w.weeks} className="rounded-input border p-2 text-center">
                    <p className="text-xs text-muted-foreground">
                      {w.weeks} {L.week}
                    </p>
                    <p
                      className={`text-sm font-semibold tabular-nums ${
                        w.profit == null ? "" : w.profit >= 0 ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {w.marginPct == null ? L.noData : `${w.marginPct}%`}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{fmtMoney(w.profit, currency, L)}</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Riesgos operativos (§15–17) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{L.risksTitle}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          {/* Scope creep */}
          <div className="rounded-input border p-4">
            <p className="text-xs font-medium text-muted-foreground">{L.scopeCreepLabel}</p>
            {snapshot.risks.scopeCreep.insufficientData ? (
              <p className="mt-2 text-sm text-muted-foreground">{L.noRiskData}</p>
            ) : (
              <>
                <p
                  className={`mt-1 text-xl font-semibold tabular-nums ${
                    snapshot.risks.scopeCreep.hasUnapprovedCreep ? "text-amber-600" : "text-foreground"
                  }`}
                >
                  {fmtPct(snapshot.risks.scopeCreep.growthPct, L)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {L.scopeApproved}: {fmtPct(snapshot.risks.scopeCreep.approvedGrowthPct, L)} ·{" "}
                  {L.scopeUnapproved}: {fmtPct(snapshot.risks.scopeCreep.unapprovedGrowthPct, L)}
                </p>
                <p className="mt-1 text-[11px] italic text-muted-foreground">{snapshot.risks.scopeCreep.note}</p>
              </>
            )}
          </div>

          {/* Retrabajo */}
          <div className="rounded-input border p-4">
            <p className="text-xs font-medium text-muted-foreground">{L.reworkLabel}</p>
            {snapshot.risks.rework.insufficientData ? (
              <p className="mt-2 text-sm text-muted-foreground">{L.noRiskData}</p>
            ) : (
              <>
                <p
                  className={`mt-1 text-xl font-semibold tabular-nums ${
                    snapshot.risks.rework.significant ? "text-amber-600" : "text-foreground"
                  }`}
                >
                  {fmtPct(snapshot.risks.rework.reworkPct, L)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {L.reworkCostLabel}: {fmtMoney(snapshot.risks.rework.cost, currency, L)}
                </p>
                <p className="mt-1 text-[11px] italic text-muted-foreground">{snapshot.risks.rework.note}</p>
              </>
            )}
          </div>

          {/* Bloqueos */}
          <div className="rounded-input border p-4">
            <p className="text-xs font-medium text-muted-foreground">{L.blockersLabel}</p>
            {snapshot.risks.blockers.insufficientData ? (
              <p className="mt-2 text-sm text-muted-foreground">{L.noRiskData}</p>
            ) : (
              <>
                <p className="mt-1 text-sm">
                  {L.blockerReal}: <span className="font-semibold">{fmtMoney(snapshot.risks.blockers.actualCost, currency, L)}</span>
                </p>
                <p className="text-sm">
                  {L.blockerCommitted}: {fmtMoney(snapshot.risks.blockers.committedCost, currency, L)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {L.blockerPotential}: {fmtMoney(snapshot.risks.blockers.potentialCost, currency, L)}
                </p>
                <p className="mt-1 text-[11px] italic text-muted-foreground">{snapshot.risks.blockers.note}</p>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Reglas del estado */}
      {status.reasons.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{L.whyStatus}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {status.reasons.map((r, i) => (
                <li key={i} className="flex gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{r.code}</span>
                  <span>{r.message}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
