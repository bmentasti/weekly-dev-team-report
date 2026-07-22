"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  generateAlerts,
  buildPresetScenarios,
  computeScenario,
  type ScenarioBase,
  type ScenarioResult,
  type FinanceAlert,
} from "@/lib/finance";
import type { FinancialSnapshot } from "@/lib/finance/engine";
import type { FinanceLabels } from "./i18n";

function money(v: number | null, currency: string, noData: string): string {
  if (v == null) return noData;
  return `${currency} ${Math.round(v).toLocaleString("en-US")}`;
}
function pctStr(v: number | null, noData: string): string {
  return v == null ? noData : `${Math.round(v * 10) / 10}%`;
}
function dateStr(iso: string | null, noData: string): string {
  if (!iso) return noData;
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}
function num(v: string): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

const sevVariant: Record<string, "destructive" | "warning" | "info"> = {
  high: "destructive",
  medium: "warning",
  low: "info",
};

export function FinanceScenarios({
  snapshot,
  canViewMargins,
  labels,
}: {
  snapshot: FinancialSnapshot;
  canViewMargins: boolean;
  labels: FinanceLabels;
}) {
  const L = labels;
  const currency = snapshot.currency;
  const noData = L.noData;

  const alerts: FinanceAlert[] = useMemo(
    () => generateAlerts(snapshot, { hasMargins: canViewMargins }),
    [snapshot, canViewMargins],
  );

  const base: ScenarioBase = useMemo(
    () => ({
      ac: snapshot.evm.ac.value,
      etc: snapshot.evm.etc.value,
      bac: snapshot.evm.bac.value,
      cpi: snapshot.evm.cpi.value,
      spi: snapshot.evm.spi.value,
      projectedRevenue: snapshot.profitability.projectedTotalRevenue.value,
      targetMarginPct: snapshot.profitability.marginVariance.provenance.inputs.targetMarginPct as number | null,
      forecastEndDate: snapshot.forecastEndDate,
      baselineProfit: snapshot.profitability.projectedProfit.value,
    }),
    [snapshot],
  );

  const presets = useMemo(() => buildPresetScenarios(base), [base]);

  // Escenario personalizado
  const [etcMult, setEtcMult] = useState("100");
  const [revMult, setRevMult] = useState("100");
  const [extraCost, setExtraCost] = useState("0");
  const [penalties, setPenalties] = useState("0");
  const [daysDelta, setDaysDelta] = useState("0");
  const custom: ScenarioResult = computeScenario(
    base,
    {
      etcMultiplier: num(etcMult) / 100,
      revenueMultiplier: num(revMult) / 100,
      extraCost: num(extraCost),
      penalties: num(penalties),
      daysDelta: num(daysDelta),
    },
    { key: "custom", label: L.customScenario, confidence: "LOW", confidenceReason: "custom" },
  );

  const confLabel: Record<string, string> = {
    HIGH: L.conf_HIGH,
    MEDIUM: L.conf_MEDIUM,
    LOW: L.conf_LOW,
    NONE: L.conf_NONE,
  };
  const sevLabel: Record<string, string> = { high: L.sev_high, medium: L.sev_medium, low: L.sev_low };

  const rows = canViewMargins ? [...presets, custom] : [];

  return (
    <div className="space-y-6">
      {/* Alertas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{L.alertsTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{L.noAlerts}</p>
          ) : (
            <ul className="space-y-3">
              {alerts.map((a) => (
                <li key={a.id} className="rounded-input border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium">{a.explanation}</p>
                    <Badge variant={sevVariant[a.severity]}>{sevLabel[a.severity]}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    <span className="font-mono">{a.formula}</span> · {L.evidenceLabel}: {a.evidence}
                  </p>
                  <p className="mt-1 text-xs">
                    <span className="font-semibold">{L.actionLabel}:</span> {a.suggestedAction}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Escenarios (sensible: sólo con viewMargins) */}
      {canViewMargins && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{L.scenariosTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3">{L.scenarioCol}</th>
                    <th className="py-2 pr-3">{L.finalCostCol}</th>
                    <th className="py-2 pr-3">{L.finalRevenueCol}</th>
                    <th className="py-2 pr-3">{L.profitCol}</th>
                    <th className="py-2 pr-3">{L.marginCol}</th>
                    <th className="py-2 pr-3">{L.endDateCol}</th>
                    <th className="py-2 pr-3">{L.diffCol}</th>
                    <th className="py-2">{L.confidenceCol}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key} className={`border-b ${r.key === "custom" ? "bg-muted/40" : ""}`}>
                      <td className="py-2 pr-3 font-medium">{r.label}</td>
                      <td className="py-2 pr-3 tabular-nums">{money(r.finalCost, currency, noData)}</td>
                      <td className="py-2 pr-3 tabular-nums">{money(r.finalRevenue, currency, noData)}</td>
                      <td
                        className={`py-2 pr-3 tabular-nums font-semibold ${
                          r.profit == null ? "" : r.profit >= 0 ? "text-emerald-600" : "text-red-600"
                        }`}
                      >
                        {money(r.profit, currency, noData)}
                      </td>
                      <td className="py-2 pr-3 tabular-nums">{pctStr(r.marginPct, noData)}</td>
                      <td className="py-2 pr-3">{dateStr(r.endDate, noData)}</td>
                      <td
                        className={`py-2 pr-3 tabular-nums ${
                          r.diffVsBaselineProfit == null
                            ? ""
                            : r.diffVsBaselineProfit >= 0
                              ? "text-emerald-600"
                              : "text-red-600"
                        }`}
                      >
                        {r.diffVsBaselineProfit == null
                          ? "—"
                          : `${r.diffVsBaselineProfit > 0 ? "+" : ""}${money(r.diffVsBaselineProfit, currency, noData)}`}
                      </td>
                      <td className="py-2" title={r.confidenceReason}>
                        {confLabel[r.confidence]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Controles del escenario personalizado */}
            <div className="grid grid-cols-2 gap-3 border-t pt-4 sm:grid-cols-5">
              <div className="flex flex-col gap-1">
                <Label className="text-xs">{L.etcMultiplierInput} %</Label>
                <Input type="number" value={etcMult} onChange={(e) => setEtcMult(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">{L.revenueMultiplierInput} %</Label>
                <Input type="number" value={revMult} onChange={(e) => setRevMult(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">{L.extraCostInput}</Label>
                <Input type="number" value={extraCost} onChange={(e) => setExtraCost(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">{L.penaltiesInput}</Label>
                <Input type="number" value={penalties} onChange={(e) => setPenalties(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">{L.daysDeltaInput}</Label>
                <Input type="number" value={daysDelta} onChange={(e) => setDaysDelta(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
