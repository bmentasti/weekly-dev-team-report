"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FinanceLabels } from "./i18n";

export interface FinanceConfigInitial {
  modality?: string;
  currency?: string;
  contractedRevenue?: number | null;
  originalCostBudget?: number | null;
  targetMarginPct?: number | null;
  startDate?: string | null;
  plannedEndDate?: string | null;
  contractualEndDate?: string | null;
  forecastEndDate?: string | null;
  manualPct?: number | null;
}

const MODALITIES = [
  ["FIXED_PRICE", "Fixed Price"],
  ["TIME_AND_MATERIALS", "Time & Materials"],
  ["MANAGED_CAPACITY", "Managed Capacity"],
  ["MILESTONE_BASED", "Milestone Based"],
  ["RETAINER", "Retainer / Fee mensual"],
  ["HYBRID", "Híbrido"],
] as const;

function toISO(dateStr: string): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
function numOrNull(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function dateInput(iso?: string | null): string {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 10);
}

export function FinanceSetup({
  projectId,
  initial,
  mode,
  labels,
}: {
  projectId: string;
  initial?: FinanceConfigInitial;
  mode: "create" | "edit";
  labels: FinanceLabels;
}) {
  const L = labels;
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // ---- Config ----
  const [modality, setModality] = useState(initial?.modality ?? "FIXED_PRICE");
  const [currency, setCurrency] = useState(initial?.currency ?? "USD");
  const [contractedRevenue, setContractedRevenue] = useState(initial?.contractedRevenue?.toString() ?? "");
  const [originalCostBudget, setOriginalCostBudget] = useState(initial?.originalCostBudget?.toString() ?? "");
  const [targetMarginPct, setTargetMarginPct] = useState(initial?.targetMarginPct?.toString() ?? "");
  const [startDate, setStartDate] = useState(dateInput(initial?.startDate));
  const [plannedEndDate, setPlannedEndDate] = useState(dateInput(initial?.plannedEndDate));
  const [contractualEndDate, setContractualEndDate] = useState(dateInput(initial?.contractualEndDate));
  const [forecastEndDate, setForecastEndDate] = useState(dateInput(initial?.forecastEndDate));
  const [manualPct, setManualPct] = useState(initial?.manualPct?.toString() ?? "");

  async function saveConfig(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const body: Record<string, unknown> = {
      modality,
      currency,
      contractedRevenue: numOrNull(contractedRevenue),
      originalCostBudget: numOrNull(originalCostBudget),
      targetMarginPct: numOrNull(targetMarginPct),
      startDate: toISO(startDate),
      plannedEndDate: toISO(plannedEndDate),
      contractualEndDate: toISO(contractualEndDate),
      forecastEndDate: toISO(forecastEndDate),
    };
    const mp = numOrNull(manualPct);
    if (mp != null) body.progressConfig = { manualPct: mp, manualWeight: 1 };
    try {
      const res = await fetch(`/api/projects/${projectId}/finance`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? L.genericError);
      setMsg({ kind: "ok", text: L.configSaved });
      router.refresh();
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : L.genericError });
    } finally {
      setSaving(false);
    }
  }

  // ---- Entradas (costo / ingreso) ----
  const [entryKind, setEntryKind] = useState<"cost" | "revenue">("cost");
  const [costCategory, setCostCategory] = useState("LABOR");
  const [costNature, setCostNature] = useState("ACTUAL");
  const [revenueType, setRevenueType] = useState("RECOGNIZED");
  const [entryAmount, setEntryAmount] = useState("");
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [entryDesc, setEntryDesc] = useState("");

  async function saveEntry(e: React.FormEvent) {
    e.preventDefault();
    const amount = numOrNull(entryAmount);
    if (amount == null) {
      setMsg({ kind: "err", text: L.invalidAmount });
      return;
    }
    setSaving(true);
    setMsg(null);
    const body =
      entryKind === "cost"
        ? {
            kind: "cost",
            category: costCategory,
            nature: costNature,
            amount,
            currency,
            incurredOn: toISO(entryDate),
            description: entryDesc || undefined,
          }
        : {
            kind: "revenue",
            type: revenueType,
            amount,
            currency,
            date: toISO(entryDate),
            description: entryDesc || undefined,
          };
    try {
      const res = await fetch(`/api/projects/${projectId}/finance/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? L.genericError);
      setMsg({ kind: "ok", text: L.entrySaved });
      setEntryAmount("");
      setEntryDesc("");
      router.refresh();
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : L.genericError });
    } finally {
      setSaving(false);
    }
  }

  const field = "flex flex-col gap-1";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {mode === "create" ? L.setupCreateTitle : L.setupEditTitle}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {msg && (
          <p className={`text-sm ${msg.kind === "ok" ? "text-emerald-600" : "text-red-600"}`} role="status">
            {msg.text}
          </p>
        )}

        {/* --- Config contractual --- */}
        <form onSubmit={saveConfig} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className={field}>
              <Label>{L.contractModality}</Label>
              <select
                value={modality}
                onChange={(e) => setModality(e.target.value)}
                className="h-10 rounded-input border bg-background px-3 text-sm"
              >
                {MODALITIES.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className={field}>
              <Label>{L.currency}</Label>
              <Input value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={8} />
            </div>
            <div className={field}>
              <Label>{L.contractedRevenue}</Label>
              <Input type="number" step="0.01" value={contractedRevenue} onChange={(e) => setContractedRevenue(e.target.value)} placeholder="200000" />
            </div>
            <div className={field}>
              <Label>{L.originalBudget}</Label>
              <Input type="number" step="0.01" value={originalCostBudget} onChange={(e) => setOriginalCostBudget(e.target.value)} placeholder="150000" />
            </div>
            <div className={field}>
              <Label>{L.targetMargin}</Label>
              <Input type="number" step="0.1" value={targetMarginPct} onChange={(e) => setTargetMarginPct(e.target.value)} placeholder="20" />
            </div>
            <div className={field}>
              <Label>{L.manualProgress}</Label>
              <Input type="number" step="1" min="0" max="100" value={manualPct} onChange={(e) => setManualPct(e.target.value)} placeholder="45" />
            </div>
            <div className={field}>
              <Label>{L.startDate}</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className={field}>
              <Label>{L.plannedEnd}</Label>
              <Input type="date" value={plannedEndDate} onChange={(e) => setPlannedEndDate(e.target.value)} />
            </div>
            <div className={field}>
              <Label>{L.contractualDate}</Label>
              <Input type="date" value={contractualEndDate} onChange={(e) => setContractualEndDate(e.target.value)} />
            </div>
            <div className={field}>
              <Label>{L.forecastEnd}</Label>
              <Input type="date" value={forecastEndDate} onChange={(e) => setForecastEndDate(e.target.value)} />
            </div>
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? L.saving : L.saveConfig}
          </Button>
        </form>

        {/* --- Alta de costo / ingreso --- */}
        <div className="border-t pt-4">
          <p className="mb-3 text-sm font-medium">{L.loadEntryTitle}</p>
          <form onSubmit={saveEntry} className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className={field}>
              <Label>{L.type}</Label>
              <select
                value={entryKind}
                onChange={(e) => setEntryKind(e.target.value as "cost" | "revenue")}
                className="h-10 rounded-input border bg-background px-3 text-sm"
              >
                <option value="cost">{L.cost}</option>
                <option value="revenue">{L.revenue}</option>
              </select>
            </div>
            {entryKind === "cost" ? (
              <>
                <div className={field}>
                  <Label>{L.category}</Label>
                  <select value={costCategory} onChange={(e) => setCostCategory(e.target.value)} className="h-10 rounded-input border bg-background px-3 text-sm">
                    {["LABOR", "VENDOR", "LICENSE", "INFRASTRUCTURE", "TRAVEL", "EXTERNAL_SERVICE", "INDIRECT", "ADMIN", "REWORK", "BLOCKER", "PENALTY", "UNPLANNED", "OTHER"].map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={field}>
                  <Label>{L.nature}</Label>
                  <select value={costNature} onChange={(e) => setCostNature(e.target.value)} className="h-10 rounded-input border bg-background px-3 text-sm">
                    {["ACTUAL", "COMMITTED", "FORECAST", "POTENTIAL"].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <div className={field}>
                <Label>{L.revenueType}</Label>
                <select value={revenueType} onChange={(e) => setRevenueType(e.target.value)} className="h-10 rounded-input border bg-background px-3 text-sm">
                  {["CONTRACTED", "INVOICED", "COLLECTED", "RECOGNIZED", "PENDING", "CHANGE_REQUEST", "BONUS", "PENALTY"].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className={field}>
              <Label>{L.amount}</Label>
              <Input type="number" step="0.01" value={entryAmount} onChange={(e) => setEntryAmount(e.target.value)} placeholder="10000" />
            </div>
            <div className={field}>
              <Label>{L.date}</Label>
              <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
            </div>
            <div className={`${field} lg:col-span-2`}>
              <Label>{L.descriptionOptional}</Label>
              <Input value={entryDesc} onChange={(e) => setEntryDesc(e.target.value)} />
            </div>
            <Button type="submit" variant="secondary" disabled={saving}>
              {saving ? L.loading : L.loadEntry}
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
