"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  FileText,
  CheckCircle2,
  AlertTriangle,
  GaugeCircle,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScheduleForm } from "@/components/schedule-form";
import { useT } from "@/components/i18n-provider";
import { useDialogs } from "@/components/ui/dialog-provider";
import {
  levelVariant,
  type ScoreLevel,
} from "@/lib/reports/score";
import type { HealthLevel, ReportMetrics } from "@/lib/reports/types";

interface ReportRow {
  id: string;
  periodStart: string;
  periodEnd: string;
  healthStatus: HealthLevel | null;
  summary: string | null;
  metrics: ReportMetrics | null;
  type: string;
  pinned: boolean;
  reviewedAt: string | null;
  tags: string[];
  createdAt: string;
  score: number;
  level: ScoreLevel;
  alerts: number;
  trend: "up" | "down" | "flat";
}

type RoleTab = "ALL" | "TL" | "PO" | "DIR";

function isoDaysAgo(d: number) {
  return new Date(Date.now() - d * 864e5).toISOString().slice(0, 10);
}

function Kpi({
  icon: Icon,
  label,
  value,
  tint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  tint: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-input" style={{ backgroundColor: `${tint}1a`, color: tint }}>
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-xl font-bold leading-none">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function trendMark(trend: string, t: (k: string) => string) {
  if (trend === "up") return <span className="text-success">{t("rep.trendUp")}</span>;
  if (trend === "down") return <span className="text-destructive">{t("rep.trendDown")}</span>;
  return <span className="text-muted-foreground">{t("rep.trendFlat")}</span>;
}

function recommendScore(r: ReportRow, role: RoleTab): number {
  let s = 0;
  if (r.level === "CRITICO") s += 50;
  else if (r.level === "ALTO_RIESGO") s += 35;
  else if (r.level === "RIESGO_MEDIO") s += 25;
  else if (r.level === "OBSERVACION") s += 15;
  if (r.trend === "down") s += 20;
  s += r.alerts * 4;
  if (!r.reviewedAt && (r.level === "CRITICO" || r.level === "ALTO_RIESGO")) s += 15;
  const m = r.metrics;
  if (role === "TL") s += (m?.codeChanges.old ?? 0) * 3 + (m?.ci?.failureRatePct ?? 0) * 0.3;
  if (role === "PO") s += (m?.quality?.scopeCreepPct ?? 0) * 0.5 + (100 - (m?.projectProgress.completionByPoints ?? 100)) * 0.2;
  if (role === "DIR" && (r.level === "CRITICO" || r.level === "ALTO_RIESGO")) s += 10;
  return s;
}

function recommendReason(r: ReportRow, role: RoleTab, t: (k: string) => string): string {
  const m = r.metrics;
  // Motivo específico según el rol seleccionado (por qué ESTE rol debería mirarlo).
  if (role === "TL" && m) {
    if ((m.ci?.failureRatePct ?? 0) >= 20) return `${t("rep.reasonCiFailing")} (${m.ci?.failureRatePct}%)`;
    if ((m.codeChanges.old ?? 0) > 0) return `${m.codeChanges.old} ${t("rep.reasonPrOpen72h")}`;
    if ((m.codeChanges.withoutReviewer ?? 0) > 0) return `${m.codeChanges.withoutReviewer} ${t("rep.reasonWithoutReviewer")}`;
    if ((m.workItems.blocked ?? 0) > 0) return `${m.workItems.blocked} ${t("rep.reasonBlockedTasks")}`;
  }
  if (role === "PO" && m) {
    if ((m.quality?.scopeCreepPct ?? 0) >= 10) return `${t("rep.reasonScopeCreep")} ${m.quality?.scopeCreepPct}%`;
    if ((m.projectProgress.completionByPoints ?? 100) < 70) return `${t("rep.reasonLowProgress")} (${m.projectProgress.completionByPoints}%)`;
    if ((m.planning.carryOverItems ?? 0) > 0) return `${m.planning.carryOverItems} ${t("rep.reasonCarryOver")}`;
    if ((m.workItems.critical ?? 0) > 0) return `${m.workItems.critical} ${t("rep.reasonCriticalTasks")}`;
  }
  if (role === "DIR") {
    if (r.level === "CRITICO" || r.level === "ALTO_RIESGO") return t("rep.reasonRiskEscalate");
    if (r.trend === "down") return t("rep.reasonSustainedDeterioration");
  }
  // Motivo general (rol "Todos" o sin señal específica del rol).
  if (r.level === "CRITICO" || r.level === "ALTO_RIESGO") return t("rep.reasonHighRisk");
  if (r.trend === "down") return t("rep.reasonDeterioration");
  if (r.alerts > 0) return `${r.alerts} ${t("rep.reasonActiveAlerts")}`;
  if (!r.reviewedAt) return t("rep.reasonUnreviewed");
  return t("rep.reasonNeedsAttention");
}

const ROLE_TAB_KEY: Record<RoleTab, string> = {
  ALL: "rep.roleAll",
  TL: "rep.roleTL",
  PO: "rep.rolePO",
  DIR: "rep.roleDIR",
};

/** Insights dependientes del rol: cada perfil ve las señales que le importan. */
function buildInsights(reports: ReportRow[], role: RoleTab, t: (k: string) => string): string[] {
  const out: string[] = [];
  const worsened = reports.filter((r) => r.trend === "down").length;
  const improved = reports.filter((r) => r.trend === "up").length;
  const withAlerts = reports.filter((r) => r.alerts > 0).length;
  let trailingRisk = 0;
  for (const r of reports) {
    if (r.level === "ALTO_RIESGO" || r.level === "CRITICO") trailingRisk++;
    else break;
  }
  const sum = (fn: (m: ReportMetrics) => number) =>
    reports.reduce((a, r) => a + (r.metrics ? fn(r.metrics) : 0), 0);
  const countBy = (fn: (m: ReportMetrics) => boolean) =>
    reports.filter((r) => r.metrics && fn(r.metrics)).length;

  if (role === "TL") {
    const oldPrs = sum((m) => m.codeChanges.old ?? 0);
    const noReviewer = sum((m) => m.codeChanges.withoutReviewer ?? 0);
    const ciFailing = countBy((m) => (m.ci?.failureRatePct ?? 0) >= 20);
    const blocked = sum((m) => m.workItems.blocked ?? 0);
    if (oldPrs > 0) out.push(`${oldPrs} ${t("rep.insightOldPrs")}`);
    if (noReviewer > 0) out.push(`${noReviewer} ${t("rep.insightNoReviewer")}`);
    if (ciFailing > 0) out.push(`${ciFailing} ${t("rep.insightCiFailing")}`);
    if (blocked > 0) out.push(`${blocked} ${t("rep.insightBlocked")}`);
    if (out.length === 0) out.push(t("rep.insightNoTechSignals"));
    return out;
  }
  if (role === "PO") {
    const scope = countBy((m) => (m.quality?.scopeCreepPct ?? 0) >= 10);
    const lowProgress = countBy((m) => (m.projectProgress.completionByPoints ?? 100) < 70);
    const carry = sum((m) => m.planning.carryOverItems ?? 0);
    const critical = sum((m) => m.workItems.critical ?? 0);
    if (scope > 0) out.push(`${scope} ${t("rep.insightScopeCreep")}`);
    if (lowProgress > 0) out.push(`${lowProgress} ${t("rep.insightLowProgress")}`);
    if (carry > 0) out.push(`${carry} ${t("rep.insightCarryOver")}`);
    if (critical > 0) out.push(`${critical} ${t("rep.insightCritical")}`);
    if (out.length === 0) out.push(t("rep.insightScopeUnderControl"));
    return out;
  }
  if (role === "DIR") {
    const risky = reports.filter((r) => r.level === "ALTO_RIESGO" || r.level === "CRITICO").length;
    if (risky > 0) out.push(`${risky} ${t("rep.insightRiskyToEscalate")}`);
    if (trailingRisk >= 2) out.push(`${t("rep.insightTrailingRiskPre")} ${trailingRisk} ${t("rep.insightTrailingRiskPost")}`);
    if (worsened > 0) out.push(`${worsened} ${t("rep.insightWorsened")}`);
    if (improved > 0) out.push(`${improved} ${t("rep.insightImproved")}`);
    if (out.length === 0) out.push(t("rep.insightStableState"));
    return out;
  }
  // ALL — visión general
  if (worsened > 0) out.push(`${worsened} ${t("rep.insightWorsenedGeneral")}`);
  if (trailingRisk >= 2) out.push(`${t("rep.insightTrailingRiskPre")} ${trailingRisk} ${t("rep.insightTrailingRiskPost")}`);
  if (withAlerts > 0) out.push(`${withAlerts} ${t("rep.insightWithAlerts")}`);
  const unreviewedRisk = reports.filter((r) => !r.reviewedAt && (r.level === "ALTO_RIESGO" || r.level === "CRITICO")).length;
  if (unreviewedRisk > 0) out.push(`${unreviewedRisk} ${t("rep.insightUnreviewedRisk")}`);
  if (improved > 0) out.push(`${improved} ${t("rep.insightImproved")}`);
  return out;
}

export default function ReportsPage() {
  const router = useRouter();
  const { t } = useT();
  const { confirm, alert: alertDialog } = useDialogs();
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [start, setStart] = useState(isoDaysAgo(14));
  const [end, setEnd] = useState(isoDaysAgo(0));
  const [role, setRole] = useState<RoleTab>("ALL");
  const [canPdf, setCanPdf] = useState(false);
  const [canGenerate, setCanGenerate] = useState(true);

  // filtros
  const [q, setQ] = useState("");
  const [levelF, setLevelF] = useState<string>("ALL");
  const [trendF, setTrendF] = useState<string>("ALL");
  const [onlyAlerts, setOnlyAlerts] = useState(false);
  const [onlyPinned, setOnlyPinned] = useState(false);

  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/reports");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? t("rep.couldNotLoad"));
      setReports(data.reports ?? []);
      setCanPdf(!!data.canPdf);
      setCanGenerate(data.canGenerate !== false);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : t("rep.networkLoadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);
  useEffect(() => {
    load();
  }, [load]);

  async function postGenerate(s: string, e: string) {
    setGenerating(true);
    setError(null);
    const res = await fetch("/api/reports/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periodStart: s, periodEnd: e }),
    });
    const json = await res.json().catch(() => ({}));
    setGenerating(false);
    if (!res.ok) return setError(json.error ?? t("rep.couldNotGenerate"));
    router.push(`/reports/${json.id}`);
  }
  const generatePreset = (days: number) =>
    postGenerate(new Date(Date.now() - days * 864e5).toISOString(), new Date().toISOString());

  async function patch(id: string, body: Record<string, unknown>) {
    await fetch(`/api/reports/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  }
  async function del(id: string) {
    const ok = await confirm({ title: t("rep.deleteReport"), confirmLabel: t("rep.deleteConfirmLabel"), danger: true });
    if (!ok) return;
    const prev = reports;
    setReports((p) => p.filter((r) => r.id !== id));
    try {
      const res = await fetch(`/api/reports/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      // revertir el update optimista y avisar
      setReports(prev);
      await alertDialog({
        title: t("rep.couldNotDelete"),
        description: t("rep.deleteError"),
      });
    }
  }

  // KPIs
  const now = new Date();
  const total = reports.length;
  const thisMonth = reports.filter((r) => {
    const d = new Date(r.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const healthy = reports.filter((r) => r.level === "SALUDABLE" || r.level === "ESTABLE").length;
  const healthyPct = total ? Math.round((healthy / total) * 100) : 0;
  const avgScore = total ? Math.round(reports.reduce((a, r) => a + r.score, 0) / total) : 0;
  const withAlerts = reports.filter((r) => r.alerts > 0).length;
  const worsened = reports.filter((r) => r.trend === "down").length;

  // insights dependientes del rol seleccionado
  const insights = useMemo(() => buildInsights(reports, role, t), [reports, role, t]);

  // recomendados
  const recommended = useMemo(() => {
    return [...reports]
      .filter((r) => r.level !== "SALUDABLE" || r.trend === "down" || r.alerts > 0 || !r.reviewedAt)
      .map((r) => ({ r, s: recommendScore(r, role) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 3)
      .map((x) => x.r);
  }, [reports, role]);

  const filtered = reports.filter((r) => {
    if (q && !(`${r.summary ?? ""} ${new Date(r.periodStart).toLocaleDateString()} ${r.tags.join(" ")}`.toLowerCase().includes(q.toLowerCase()))) return false;
    if (levelF !== "ALL" && r.level !== levelF) return false;
    if (trendF !== "ALL" && r.trend !== trendF) return false;
    if (onlyAlerts && r.alerts === 0) return false;
    if (onlyPinned && !r.pinned) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("rep.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("rep.subtitle")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/reports/standards">{t("rep.healthThresholds")}</Link>
          </Button>
          {reports.length >= 2 && (
            <Button variant="outline" asChild><Link href="/reports/compare">{t("rep.compare")}</Link></Button>
          )}
          {canGenerate && (
            <Button onClick={() => setShowPicker((v) => !v)}>
              <Sparkles className="mr-2 h-4 w-4" />{t("rep.generateReport")}
            </Button>
          )}
        </div>
      </div>

      {showPicker && (
        <Card>
          <CardContent className="space-y-4 py-5">
            {error && <p className="rounded-input bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2"><Label htmlFor="s">{t("rep.from")}</Label><Input id="s" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="e">{t("rep.to")}</Label><Input id="e" type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
              <Button disabled={generating} onClick={() => postGenerate(new Date(start).toISOString(), new Date(`${end}T23:59:59`).toISOString())}>
                {generating ? t("rep.generating") : t("rep.generate")}
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">{t("rep.shortcuts")}</span>
              {[[t("rep.presetLastSprint"), 14], [t("rep.presetLastMonth"), 30], [t("rep.presetLast3Months"), 90], [t("rep.presetLast6Months"), 180], [t("rep.presetLastYear"), 365]].map(([l, d]) => (
                <Button key={l as string} variant="outline" size="sm" disabled={generating} onClick={() => generatePreset(d as number)}>{l}</Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <Kpi icon={FileText} label={t("rep.kpiTotal")} value={total} tint="#2563FF" />
        <Kpi icon={FileText} label={t("rep.kpiThisMonth")} value={thisMonth} tint="#2563FF" />
        <Kpi icon={CheckCircle2} label={t("rep.kpiHealthyPct")} value={`${healthyPct}%`} tint="#16C784" />
        <Kpi icon={GaugeCircle} label={t("rep.kpiAvgHealth")} value={avgScore} tint="#16C784" />
        <Kpi icon={AlertTriangle} label={t("rep.kpiWithAlerts")} value={withAlerts} tint="#E5484D" />
        <Kpi icon={AlertTriangle} label={t("rep.kpiWorsened")} value={worsened} tint="#E5484D" />
      </div>

      {/* Role tabs */}
      <div className="flex flex-col gap-1">
        <div className="inline-flex w-fit rounded-full border bg-card p-1 text-sm">
          {(["ALL", "TL", "PO", "DIR"] as RoleTab[]).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              aria-pressed={role === r}
              className={`rounded-full px-3 py-1.5 font-medium transition-colors ${role === r ? "bg-primary text-white" : "text-muted-foreground"}`}
            >
              {t(ROLE_TAB_KEY[r])}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {role === "ALL"
            ? t("rep.roleHintAllPre")
            : `${t("rep.roleHintFocused")} ${t(ROLE_TAB_KEY[role])}.`}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Insights */}
        <Card>
          <CardHeader><CardTitle className="text-lg">{t("rep.insights")}{role !== "ALL" ? ` · ${t(ROLE_TAB_KEY[role])}` : ""}</CardTitle></CardHeader>
          <CardContent>
            {insights.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("rep.allCalm")}</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {insights.map((i, k) => (
                  <li key={k} className="flex gap-2"><span className="text-primary">•</span>{i}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Recomendados */}
        <Card>
          <CardHeader><CardTitle className="text-lg">{t("rep.recommendedToReview")}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {recommended.length === 0 && <p className="text-sm text-muted-foreground">{t("rep.nothingUrgent")}</p>}
            {recommended.map((r) => (
              <Link key={r.id} href={`/reports/${r.id}`} className="block rounded-input border p-3 hover:bg-muted/40">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">
                    {new Date(r.periodStart).toLocaleDateString()}–{new Date(r.periodEnd).toLocaleDateString()}
                  </span>
                  <Badge variant={levelVariant(r.level)}>{t(`lib.level.${r.level}`)}</Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{recommendReason(r, role, t)}</p>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <ScheduleForm />

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <Input className="max-w-xs" placeholder={t("rep.searchPlaceholder")} value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="h-10 rounded-input border border-input bg-card px-3 text-sm" value={levelF} onChange={(e) => setLevelF(e.target.value)}>
          <option value="ALL">{t("rep.allLevels")}</option>
          {(["SALUDABLE", "ESTABLE", "OBSERVACION", "ALTO_RIESGO", "CRITICO"] as ScoreLevel[]).map((l) => (
            <option key={l} value={l}>{t(`lib.level.${l}`)}</option>
          ))}
        </select>
        <select className="h-10 rounded-input border border-input bg-card px-3 text-sm" value={trendF} onChange={(e) => setTrendF(e.target.value)}>
          <option value="ALL">{t("rep.allTrends")}</option>
          <option value="up">{t("rep.filterImproved")}</option>
          <option value="down">{t("rep.filterWorsened")}</option>
          <option value="flat">{t("rep.filterStable")}</option>
        </select>
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={onlyAlerts} onChange={(e) => setOnlyAlerts(e.target.checked)} /> {t("rep.withAlertsFilter")}</label>
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={onlyPinned} onChange={(e) => setOnlyPinned(e.target.checked)} /> {t("rep.favorites")}</label>
      </div>

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label={t("rep.tableReportsLabel")}>
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th scope="col" className="px-4 py-3 font-medium">{t("rep.colReport")}</th>
                  <th scope="col" className="px-4 py-3 font-medium">{t("rep.colHealth")}</th>
                  <th scope="col" className="px-4 py-3 font-medium">{t("rep.colTrend")}</th>
                  <th scope="col" className="px-4 py-3 font-medium">{t("rep.colAlerts")}</th>
                  <th scope="col" className="px-4 py-3 font-medium">{t("rep.colGenerated")}</th>
                  <th scope="col" className="px-4 py-3 font-medium">{t("rep.colActions")}</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">{t("rep.loading")}</td></tr>}
                {!loading && loadError && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center">
                    <p className="text-sm text-destructive">{loadError}</p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={load}>{t("rep.retry")}</Button>
                  </td></tr>
                )}
                {!loading && !loadError && filtered.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    {total === 0 ? t("rep.noReportsYet") : t("rep.noReportsMatch")}
                  </td></tr>
                )}
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => patch(r.id, { pinned: !r.pinned })}
                          title={t("rep.favorite")}
                          aria-label={r.pinned ? t("rep.removeFromFavorites") : t("rep.markAsFavorite")}
                          aria-pressed={r.pinned}
                        >
                          <Star aria-hidden="true" className={`h-4 w-4 ${r.pinned ? "fill-warning text-warning" : "text-muted-foreground"}`} />
                        </button>
                        <Link href={`/reports/${r.id}`} className="font-medium hover:text-primary">
                          {new Date(r.periodStart).toLocaleDateString()}–{new Date(r.periodEnd).toLocaleDateString()}
                        </Link>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase text-muted-foreground">{r.type}</span>
                        {r.reviewedAt && <span className="text-[10px] text-success">{t("rep.reviewed")}</span>}
                      </div>
                      {r.tags.length > 0 && (
                        <div className="mt-1 flex gap-1">{r.tags.map((t) => <span key={t} className="rounded bg-primary/10 px-1.5 text-[10px] text-primary">{t}</span>)}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{r.score}</span>
                        <Badge variant={levelVariant(r.level)}>{t(`lib.level.${r.level}`)}</Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">{trendMark(r.trend, t)}</td>
                    <td className="px-4 py-3">{r.alerts > 0 ? <Badge variant="warning">{r.alerts}</Badge> : <span className="text-muted-foreground">0</span>}</td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <Link href={`/reports/${r.id}`} className="text-primary hover:underline">{t("rep.view")}</Link>
                        <a href={`/api/reports/${r.id}/export`} className="text-primary hover:underline">CSV</a>
                        {canPdf && (
                          <a href={`/api/reports/${r.id}/pdf`} className="text-primary hover:underline">PDF</a>
                        )}
                        <button onClick={() => patch(r.id, { reviewed: !r.reviewedAt })} className="text-muted-foreground hover:text-foreground">
                          {r.reviewedAt ? t("rep.markUnreviewed") : t("rep.markReviewed")}
                        </button>
                        <button onClick={() => del(r.id)} className="text-muted-foreground hover:text-destructive">{t("rep.delete")}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
