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
import { useDialogs } from "@/components/ui/dialog-provider";
import {
  LEVEL_LABEL,
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

function trendMark(t: string) {
  if (t === "up") return <span className="text-emerald-600">▲ mejora</span>;
  if (t === "down") return <span className="text-destructive">▼ baja</span>;
  return <span className="text-muted-foreground">= estable</span>;
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

function recommendReason(r: ReportRow): string {
  if (r.level === "CRITICO" || r.level === "ALTO_RIESGO") return "Nivel de riesgo alto";
  if (r.trend === "down") return "Deterioro vs el anterior";
  if (r.alerts > 0) return `${r.alerts} alerta(s) activas`;
  if (!r.reviewedAt) return "Sin revisar";
  return "Requiere atención";
}

export default function ReportsPage() {
  const router = useRouter();
  const { confirm } = useDialogs();
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reports");
      const data = await res.json();
      setReports(data.reports ?? []);
      setCanPdf(!!data.canPdf);
      setCanGenerate(data.canGenerate !== false);
    } finally {
      setLoading(false);
    }
  }, []);
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
    if (!res.ok) return setError(json.error ?? "No se pudo generar.");
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
    const ok = await confirm({ title: "Eliminar reporte", confirmLabel: "Eliminar", danger: true });
    if (!ok) return;
    setReports((p) => p.filter((r) => r.id !== id));
    await fetch(`/api/reports/${id}`, { method: "DELETE" });
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
  const improved = reports.filter((r) => r.trend === "up").length;
  const worsened = reports.filter((r) => r.trend === "down").length;

  // insights
  const insights: string[] = [];
  if (worsened > 0) insights.push(`${worsened} reporte(s) empeoraron respecto al anterior.`);
  let trailingRisk = 0;
  for (const r of reports) {
    if (r.level === "ALTO_RIESGO" || r.level === "CRITICO") trailingRisk++;
    else break;
  }
  if (trailingRisk >= 2) insights.push(`El proyecto acumula ${trailingRisk} sprints seguidos en alto riesgo.`);
  if (withAlerts > 0) insights.push(`${withAlerts} reporte(s) con alertas activas.`);
  const unreviewedRisk = reports.filter((r) => !r.reviewedAt && (r.level === "ALTO_RIESGO" || r.level === "CRITICO")).length;
  if (unreviewedRisk > 0) insights.push(`${unreviewedRisk} reporte(s) de riesgo sin revisar.`);
  if (improved > 0) insights.push(`${improved} reporte(s) mejoraron su salud.`);

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
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Reportes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Estado de tus sprints en una vista: qué está saludable, qué requiere atención y qué revisar primero.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/reports/standards">Umbrales de salud</Link>
          </Button>
          {reports.length >= 2 && (
            <Button variant="outline" asChild><Link href="/reports/compare">Comparar</Link></Button>
          )}
          {canGenerate && (
            <Button onClick={() => setShowPicker((v) => !v)}>
              <Sparkles className="mr-2 h-4 w-4" />Generar reporte
            </Button>
          )}
        </div>
      </div>

      {showPicker && (
        <Card>
          <CardContent className="space-y-4 py-5">
            {error && <p className="rounded-input bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2"><Label htmlFor="s">Desde</Label><Input id="s" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="e">Hasta</Label><Input id="e" type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
              <Button disabled={generating} onClick={() => postGenerate(new Date(start).toISOString(), new Date(`${end}T23:59:59`).toISOString())}>
                {generating ? "Generando..." : "Generar"}
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Atajos:</span>
              {[["Último sprint", 14], ["Último mes", 30], ["Últimos 3 meses", 90], ["Últimos 6 meses", 180], ["Último año", 365]].map(([l, d]) => (
                <Button key={l as string} variant="outline" size="sm" disabled={generating} onClick={() => generatePreset(d as number)}>{l}</Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <Kpi icon={FileText} label="Total" value={total} tint="#2563FF" />
        <Kpi icon={FileText} label="Este mes" value={thisMonth} tint="#2563FF" />
        <Kpi icon={CheckCircle2} label="% Saludables" value={`${healthyPct}%`} tint="#16C784" />
        <Kpi icon={GaugeCircle} label="Salud promedio" value={avgScore} tint="#16C784" />
        <Kpi icon={AlertTriangle} label="Con alertas" value={withAlerts} tint="#E5484D" />
        <Kpi icon={AlertTriangle} label="Empeoraron" value={worsened} tint="#E5484D" />
      </div>

      {/* Role tabs */}
      <div className="inline-flex rounded-full border bg-card p-1 text-sm">
        {(["ALL", "TL", "PO", "DIR"] as RoleTab[]).map((r) => (
          <button key={r} onClick={() => setRole(r)} className={`rounded-full px-3 py-1.5 font-medium ${role === r ? "bg-primary text-white" : "text-muted-foreground"}`}>
            {r === "ALL" ? "Todos" : r === "TL" ? "Tech Lead" : r === "PO" ? "Product Owner" : "Dirección"}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Insights */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Insights</CardTitle></CardHeader>
          <CardContent>
            {insights.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todo tranquilo por acá. 🎉</p>
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
          <CardHeader><CardTitle className="text-lg">Recomendados para revisar</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {recommended.length === 0 && <p className="text-sm text-muted-foreground">Nada urgente para revisar.</p>}
            {recommended.map((r) => (
              <Link key={r.id} href={`/reports/${r.id}`} className="block rounded-input border p-3 hover:bg-muted/40">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">
                    {new Date(r.periodStart).toLocaleDateString()}–{new Date(r.periodEnd).toLocaleDateString()}
                  </span>
                  <Badge variant={levelVariant(r.level)}>{LEVEL_LABEL[r.level]}</Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{recommendReason(r)}</p>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <ScheduleForm />

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <Input className="max-w-xs" placeholder="Buscar por resumen, fecha o tag..." value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="h-10 rounded-input border border-input bg-card px-3 text-sm" value={levelF} onChange={(e) => setLevelF(e.target.value)}>
          <option value="ALL">Todos los niveles</option>
          {(["SALUDABLE", "ESTABLE", "OBSERVACION", "ALTO_RIESGO", "CRITICO"] as ScoreLevel[]).map((l) => (
            <option key={l} value={l}>{LEVEL_LABEL[l]}</option>
          ))}
        </select>
        <select className="h-10 rounded-input border border-input bg-card px-3 text-sm" value={trendF} onChange={(e) => setTrendF(e.target.value)}>
          <option value="ALL">Toda tendencia</option>
          <option value="up">Mejoró</option>
          <option value="down">Empeoró</option>
          <option value="flat">Estable</option>
        </select>
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={onlyAlerts} onChange={(e) => setOnlyAlerts(e.target.checked)} /> con alertas</label>
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={onlyPinned} onChange={(e) => setOnlyPinned(e.target.checked)} /> favoritos</label>
      </div>

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Reporte</th>
                  <th className="px-4 py-3 font-medium">Salud</th>
                  <th className="px-4 py-3 font-medium">Tendencia</th>
                  <th className="px-4 py-3 font-medium">Alertas</th>
                  <th className="px-4 py-3 font-medium">Generado</th>
                  <th className="px-4 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Cargando...</td></tr>}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    {total === 0 ? "Todavía no generaste reportes. Conectá herramientas y generá el primero." : "Ningún reporte coincide con los filtros."}
                  </td></tr>
                )}
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => patch(r.id, { pinned: !r.pinned })} title="Favorito">
                          <Star className={`h-4 w-4 ${r.pinned ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                        </button>
                        <Link href={`/reports/${r.id}`} className="font-medium hover:text-primary">
                          {new Date(r.periodStart).toLocaleDateString()}–{new Date(r.periodEnd).toLocaleDateString()}
                        </Link>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase text-muted-foreground">{r.type}</span>
                        {r.reviewedAt && <span className="text-[10px] text-emerald-600">✓ revisado</span>}
                      </div>
                      {r.tags.length > 0 && (
                        <div className="mt-1 flex gap-1">{r.tags.map((t) => <span key={t} className="rounded bg-primary/10 px-1.5 text-[10px] text-primary">{t}</span>)}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{r.score}</span>
                        <Badge variant={levelVariant(r.level)}>{LEVEL_LABEL[r.level]}</Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">{trendMark(r.trend)}</td>
                    <td className="px-4 py-3">{r.alerts > 0 ? <Badge variant="warning">{r.alerts}</Badge> : <span className="text-muted-foreground">0</span>}</td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <Link href={`/reports/${r.id}`} className="text-primary hover:underline">Ver</Link>
                        <a href={`/api/reports/${r.id}/export`} className="text-primary hover:underline">CSV</a>
                        {canPdf && (
                          <a href={`/api/reports/${r.id}/pdf`} className="text-primary hover:underline">PDF</a>
                        )}
                        <button onClick={() => patch(r.id, { reviewed: !r.reviewedAt })} className="text-muted-foreground hover:text-foreground">
                          {r.reviewedAt ? "Sin revisar" : "Revisado"}
                        </button>
                        <button onClick={() => del(r.id)} className="text-muted-foreground hover:text-destructive">Eliminar</button>
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
