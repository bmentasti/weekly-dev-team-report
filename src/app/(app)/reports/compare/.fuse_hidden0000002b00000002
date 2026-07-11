"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HEALTH_LABEL, healthBadgeVariant } from "@/lib/reports/health";
import { BackButton } from "@/components/back-button";
import {
  compareMetrics,
  classifyTrends,
  comparisonAlerts,
  evolvePeople,
  planningRecommendation,
  TREND_LABEL,
  PERSON_CAT_LABEL,
  type Role,
  type TrendClass,
  type PersonCat,
} from "@/lib/reports/compare";
import type { HealthLevel, ReportMetrics } from "@/lib/reports/types";

interface ReportRow {
  id: string;
  periodStart: string;
  periodEnd: string;
  healthStatus: HealthLevel | null;
}
interface FullReport {
  id: string;
  periodStart: string;
  periodEnd: string;
  healthStatus: HealthLevel | null;
  summary: string | null;
  metrics: ReportMetrics | null;
}

function label(r: ReportRow) {
  return `${new Date(r.periodStart).toLocaleDateString()}–${new Date(r.periodEnd).toLocaleDateString()}`;
}

function trendVariant(c: TrendClass): "success" | "secondary" | "warning" | "destructive" {
  if (c === "MEJORA_CLARA" || c === "MEJORA_LEVE") return "success";
  if (c === "SIN_CAMBIO") return "secondary";
  if (c === "DETERIORO_LEVE") return "warning";
  return "destructive";
}
function catVariant(c: PersonCat): "success" | "secondary" | "warning" | "destructive" {
  if (c === "DESTACADA") return "success";
  if (c === "OBSERVACION") return "warning";
  if (c === "RIESGO") return "destructive";
  return "secondary";
}

const ROLE_TABS: { key: Role | "ALL"; label: string }[] = [
  { key: "ALL", label: "Todos" },
  { key: "TL", label: "Tech Lead" },
  { key: "PO", label: "Product Owner" },
  { key: "DIR", label: "Dirección" },
];

export default function ComparePage() {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [aId, setAId] = useState("");
  const [bId, setBId] = useState("");
  const [a, setA] = useState<FullReport | null>(null);
  const [b, setB] = useState<FullReport | null>(null);
  const [role, setRole] = useState<Role | "ALL">("ALL");
  const [ai, setAi] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiErr, setAiErr] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/reports");
      const list: ReportRow[] = (await res.json()).reports ?? [];
      setReports(list);
      if (list[0]) setAId(list[0].id);
      if (list[1]) setBId(list[1].id);
    })();
  }, []);

  const fetchReport = useCallback(async (id: string) => {
    if (!id) return null;
    const res = await fetch(`/api/reports/${id}`);
    if (!res.ok) return null;
    return (await res.json()).report as FullReport;
  }, []);
  useEffect(() => {
    fetchReport(aId).then(setA);
  }, [aId, fetchReport]);
  useEffect(() => {
    fetchReport(bId).then(setB);
  }, [bId, fetchReport]);

  async function analyze(prompt?: string) {
    setAiLoading(true);
    setAiErr(null);
    setAi(null);
    const res = await fetch("/api/reports/compare/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aId, bId, prompt }),
    });
    const json = await res.json().catch(() => ({}));
    setAiLoading(false);
    if (json.answer) setAi(json.answer);
    else setAiErr(json.error ?? "No se pudo generar el análisis.");
  }

  const ready = a?.metrics && b?.metrics;
  const mA = a?.metrics as ReportMetrics | undefined;
  const mB = b?.metrics as ReportMetrics | undefined;

  const metrics = ready ? compareMetrics(mA!, mB!) : [];
  const shownMetrics = role === "ALL" ? metrics : metrics.filter((m) => m.roles.includes(role));
  const trends = ready ? classifyTrends(mA!, mB!) : [];
  const alerts = ready ? comparisonAlerts(mA!, mB!) : [];
  const shownAlerts = role === "ALL" ? alerts : alerts.filter((al) => al.role === role);
  const people = ready ? evolvePeople(mA!, mB!) : [];
  const plan = ready ? planningRecommendation(mA!, mB!) : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <BackButton label="Volver a reportes" />
      <h1 className="text-2xl font-bold tracking-tight">Comparar sprints</h1>

      {reports.length < 2 ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Necesitás al menos 2 reportes. Generá con los atajos de período.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { id: aId, set: setAId, letter: "A (reciente)" },
              { id: bId, set: setBId, letter: "B (anterior)" },
            ].map((sel) => (
              <div key={sel.letter} className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  {sel.letter}
                </label>
                <select
                  className="flex h-10 w-full rounded-input border border-input bg-white px-3 text-sm"
                  value={sel.id}
                  onChange={(e) => sel.set(e.target.value)}
                >
                  {reports.map((r) => (
                    <option key={r.id} value={r.id}>
                      {label(r)}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {a && b && (
            <div className="grid gap-4 sm:grid-cols-2">
              {[a, b].map((r, i) => (
                <Card key={r.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{i === 0 ? "A" : "B"}</CardTitle>
                      <Badge variant={healthBadgeVariant(r.healthStatus)}>
                        {r.healthStatus ? HEALTH_LABEL[r.healthStatus] : "—"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(r.periodStart).toLocaleDateString()} – {new Date(r.periodEnd).toLocaleDateString()}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{r.summary}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {ready && (
            <>
              {/* Role tabs */}
              <div className="inline-flex rounded-full border bg-white p-1 text-sm">
                {ROLE_TABS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setRole(t.key)}
                    className={`rounded-full px-3 py-1.5 font-medium ${role === t.key ? "bg-primary text-white" : "text-muted-foreground"}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Metric table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Métricas: A vs B</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="py-2 pr-4 font-medium">Métrica</th>
                          <th className="py-2 pr-4 font-medium">A</th>
                          <th className="py-2 pr-4 font-medium">B</th>
                          <th className="py-2 pr-4 font-medium">Δ</th>
                          <th className="py-2 pr-4 font-medium">%</th>
                          <th className="py-2 pr-4 font-medium">Lectura</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shownMetrics.map((m) => (
                          <tr key={m.key} className="border-b last:border-0">
                            <td className="py-2 pr-4">{m.label}</td>
                            <td className="py-2 pr-4">{m.a}</td>
                            <td className="py-2 pr-4">{m.b}</td>
                            <td className={`py-2 pr-4 ${m.direction === "good" ? "text-emerald-600" : m.direction === "bad" ? "text-destructive" : "text-muted-foreground"}`}>
                              {m.deltaAbs > 0 ? "+" : ""}{m.deltaAbs}
                            </td>
                            <td className="py-2 pr-4 text-muted-foreground">
                              {m.deltaPct === null ? "—" : `${m.deltaPct > 0 ? "+" : ""}${m.deltaPct}%`}
                            </td>
                            <td className="py-2 pr-4">
                              <span className={m.direction === "good" ? "text-emerald-600" : m.direction === "bad" ? "text-destructive" : "text-muted-foreground"}>
                                {m.interpretation}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Trends */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Tendencias</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {trends.map((t) => (
                    <span key={t.dimension} className="flex items-center gap-2 rounded-input border px-3 py-1.5 text-sm">
                      {t.dimension}
                      <Badge variant={trendVariant(t.class)}>{TREND_LABEL[t.class]}</Badge>
                    </span>
                  ))}
                </CardContent>
              </Card>

              {/* Alerts */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Alertas de la comparación</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {shownAlerts.length === 0 && (
                    <p className="text-sm text-muted-foreground">Sin alertas para esta vista.</p>
                  )}
                  {shownAlerts.map((al) => (
                    <div key={al.id} className="rounded-input border p-3">
                      <div className="flex items-center gap-2">
                        <Badge variant={al.level === "alta" ? "destructive" : "warning"}>{al.level}</Badge>
                        <span className="font-medium">{al.title}</span>
                        <span className="text-xs text-muted-foreground">· {al.evidence}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Impacto:</span> {al.impact}
                      </p>
                      <p className="mt-1 text-xs">
                        <span className="font-medium text-primary">Acción:</span> {al.action}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Person evolution */}
              {people.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Evolución por persona</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-muted-foreground">
                            <th className="py-2 pr-4 font-medium">Persona</th>
                            <th className="py-2 pr-4 font-medium">Categoría</th>
                            <th className="py-2 pr-4 font-medium">Throughput A</th>
                            <th className="py-2 pr-4 font-medium">Throughput B</th>
                            <th className="py-2 pr-4 font-medium">Mov.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {people.map((p) => (
                            <tr key={p.name} className="border-b last:border-0">
                              <td className="py-2 pr-4 font-medium">{p.name}</td>
                              <td className="py-2 pr-4">
                                <Badge variant={catVariant(p.category)}>{PERSON_CAT_LABEL[p.category]}</Badge>
                              </td>
                              <td className="py-2 pr-4">{p.s2?.throughput ?? "—"}</td>
                              <td className="py-2 pr-4">{p.s1?.throughput ?? "—"}</td>
                              <td className="py-2 pr-4">
                                {p.movement === "up" ? "▲" : p.movement === "down" ? "▼" : "="}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Planning */}
              {plan && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Recomendación para el próximo sprint</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p><span className="font-medium">Capacidad sugerida:</span> ~{plan.suggestedCapacity} pts</p>
                    <p><span className="font-medium">Scope:</span> {plan.scope}</p>
                    <p><span className="font-medium">Margen:</span> {plan.margin}</p>
                    {plan.notes.length > 0 && (
                      <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                        {plan.notes.map((n, i) => <li key={i}>{n}</li>)}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* AI comparative (Pro) */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Análisis comparativo con IA (Pro)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => analyze()} disabled={aiLoading}>
                      {aiLoading ? "Analizando..." : "Analizar con IA"}
                    </Button>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      className="flex h-10 flex-1 rounded-input border border-input bg-white px-3 text-sm"
                      placeholder="Preguntá algo sobre la comparación..."
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                    />
                    <Button variant="outline" onClick={() => analyze(aiPrompt)} disabled={aiLoading || !aiPrompt.trim()}>
                      Preguntar
                    </Button>
                  </div>
                  {aiErr && (
                    <p className="rounded-input bg-destructive/10 px-3 py-2 text-sm text-destructive">{aiErr}</p>
                  )}
                  {ai && (
                    <div className="rounded-input border bg-muted/40 p-3">
                      <p className="whitespace-pre-wrap text-sm">{ai}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
