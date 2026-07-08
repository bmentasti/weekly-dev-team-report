"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CHART,
  SERIES,
  axisProps,
  gridProps,
  ChartTooltip,
  ChartLegend,
  LinearGradient,
  gradientId,
} from "@/components/charts/chart-theme";
import {
  Rocket,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Sparkles,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportNotes } from "@/components/report-notes";
import { ScoreBreakdown } from "@/components/score-breakdown";
import { CustomAlerts } from "@/components/custom-alerts";
import { ReportShares } from "@/components/report-shares";
import { EmailReport } from "@/components/email-report";
import { AutomatedAnalysis } from "@/components/automated-analysis";
import { ReportRoleViews } from "@/components/report-role-views";
import { AiAskBox } from "@/components/ai-ask-box";
import { BackButton } from "@/components/back-button";
import { useDialogs } from "@/components/ui/dialog-provider";
import { HEALTH_LABEL, healthBadgeVariant } from "@/lib/reports/health";
import { PERSON_CATEGORY_LABEL, personCategoryVariant } from "@/lib/reports/labels";
import type { HealthLevel, ReportHighlights, ReportMetrics, Risk } from "@/lib/reports/types";

interface ReportRow {
  id: string;
  projectId: string | null;
  periodStart: string;
  periodEnd: string;
  status: string;
  healthStatus: HealthLevel | null;
  summary: string | null;
  metrics: ReportMetrics | null;
  risks: Risk[] | null;
  recommendations: string[] | null;
  rawData: {
    markdown?: string;
    highlights?: ReportHighlights;
    sourcesWithError?: string[];
    aiAnalysis?: string | null;
    aiProvider?: string | null;
  } | null;
}

const AI_LABEL: Record<string, string> = {
  ANTHROPIC: "Claude",
  OPENAI: "ChatGPT",
  GEMINI: "Gemini",
  COPILOT: "Copilot",
};

const HEALTH_COLOR: Record<HealthLevel, string> = {
  HEALTHY: "#16C784",
  MEDIUM_RISK: "#F5A623",
  HIGH_RISK: "#E5484D",
};

function Kpi({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="py-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-3xl font-bold tracking-tight">{value}</p>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function ScoreDonut({
  value,
  health,
}: {
  value: number;
  health: HealthLevel | null;
}) {
  const color = health ? HEALTH_COLOR[health] : "#2563FF";
  const data = [
    { name: "v", value },
    { name: "r", value: Math.max(100 - value, 0) },
  ];
  return (
    <Card>
      <CardContent className="flex h-full flex-col items-center justify-center gap-2 py-5 text-center">
        <div className="relative h-16 w-16 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                innerRadius={22}
                outerRadius={30}
                startAngle={90}
                endAngle={-270}
                cornerRadius={4}
                stroke="none"
              >
                <Cell fill={color} />
                <Cell fill="#E6EBF2" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center text-sm font-bold">
            {value}%
          </div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <p className="text-xs text-muted-foreground">Salud del equipo</p>
          <Badge variant={healthBadgeVariant(health)}>
            {health ? HEALTH_LABEL[health] : "—"}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryStat({
  icon: Icon,
  label,
  value,
  sub,
  tint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  tint: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="flex h-10 w-10 items-center justify-center rounded-input"
        style={{ backgroundColor: `${tint}1a`, color: tint }}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-bold">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

export default function ReportPreviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { confirm } = useDialogs();
  const [report, setReport] = useState<ReportRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [peopleHidden, setPeopleHidden] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/reports/${params.id}`);
        const json = await res.json();
        if (!res.ok) setError(json.error ?? "No se pudo cargar el reporte.");
        else {
          setReport(json.report);
          setPeopleHidden(json.access && json.access.canViewPeople === false);
        }
      } catch {
        setError("Error de red al cargar el reporte.");
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id]);

  async function copyMarkdown() {
    if (!report?.rawData?.markdown) return;
    await navigator.clipboard.writeText(report.rawData.markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function deleteReport() {
    const ok = await confirm({
      title: "Eliminar reporte",
      description: "No se puede deshacer.",
      confirmLabel: "Eliminar",
      danger: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/reports/${params.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/reports");
      router.refresh();
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Cargando...</p>;
  if (error || !report)
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" asChild>
          <Link href="/reports">Volver a reportes</Link>
        </Button>
      </div>
    );

  const m = report.metrics;
  const h = report.rawData?.highlights;
  const days = Math.round(
    (new Date(report.periodEnd).getTime() -
      new Date(report.periodStart).getTime()) /
      (24 * 60 * 60 * 1000),
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <BackButton label="Volver a reportes" />
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Reporte del equipo
          </h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            {new Date(report.periodStart).toLocaleDateString()} –{" "}
            {new Date(report.periodEnd).toLocaleDateString()} ({days} días)
            <Badge variant={healthBadgeVariant(report.healthStatus)}>
              {report.healthStatus ? HEALTH_LABEL[report.healthStatus] : "—"}
            </Badge>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={copyMarkdown}>
            {copied ? "¡Copiado!" : "Copiar texto"}
          </Button>
          <Button variant="outline" asChild>
            <a href={`/api/reports/${params.id}/export`}>Exportar CSV</a>
          </Button>
          <Button onClick={() => setShowEmail((v) => !v)}>
            Enviar por email
          </Button>
          <Button
            variant="ghost"
            onClick={deleteReport}
            className="text-muted-foreground hover:text-destructive"
          >
            Eliminar
          </Button>
        </div>
      </div>

      {report.rawData?.sourcesWithError &&
        report.rawData.sourcesWithError.length > 0 && (
          <p className="rounded-input bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Algunas fuentes fallaron: {report.rawData.sourcesWithError.join(", ")}.
          </p>
        )}

      {showEmail && <EmailReport reportId={params.id} />}

      {report.rawData?.aiAnalysis && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-4 w-4 text-primary" />
              Análisis con IA
              {report.rawData.aiProvider && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                  {AI_LABEL[report.rawData.aiProvider] ?? report.rawData.aiProvider}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">
              {report.rawData.aiAnalysis}
            </p>
          </CardContent>
        </Card>
      )}

      {report.rawData?.aiProvider && <AiAskBox reportId={params.id} />}

      {m && m.capacity && (
        <>
          <ReportRoleViews metrics={m} healthStatus={report.healthStatus} />

          {peopleHidden && (
            <div className="rounded-input border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Los datos por persona están ocultos según tu nivel de acceso a este
              reporte.
            </div>
          )}

          {/* KPI row */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <Kpi
              label="Tareas finalizadas"
              value={m.workItems.done}
              sub={`de ${m.workItems.total} totales`}
            />
            <Kpi label="PR/MR mergeados" value={m.codeChanges.merged} />
            <Kpi
              label="Cycle time"
              value={
                m.capacity.cycleTimeAvgDays != null
                  ? `${m.capacity.cycleTimeAvgDays}d`
                  : "—"
              }
            />
            <Kpi label="Tareas bloqueadas" value={m.workItems.blocked} />
            <ScoreDonut
              value={m.projectProgress.completionByPoints}
              health={report.healthStatus}
            />
          </div>

          {/* Explicabilidad del score */}
          <ScoreBreakdown metrics={m} projectId={report.projectId} />

          {/* Alertas personalizadas (Pro) */}
          <CustomAlerts metrics={m} />

          {/* Summary + Trend */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="h-4 w-4" />
                  Resumen del sprint
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <p className="text-sm">{report.summary}</p>
                <div className="grid grid-cols-3 gap-3">
                  <SummaryStat
                    icon={Rocket}
                    label="Comprometido"
                    value={`${m.capacity.committedPoints} pts`}
                    tint="#2563FF"
                  />
                  <SummaryStat
                    icon={CheckCircle2}
                    label="Completado"
                    value={`${m.projectProgress.completionByPoints}%`}
                    sub={`${m.capacity.completedPoints} pts`}
                    tint="#16C784"
                  />
                  <SummaryStat
                    icon={Clock}
                    label="Carry-over"
                    value={`${m.planning.carryOverPoints} pts`}
                    sub={`${m.planning.carryOverItems} tareas`}
                    tint="#F5A623"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tendencia</CardTitle>
              </CardHeader>
              <CardContent>
                {report.rawData && m.trend.length >= 2 ? (
                  <div>
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={m.trend}>
                          <defs>
                            <LinearGradient id={gradientId("rep-velocity")} color={SERIES.velocity} />
                          </defs>
                          <CartesianGrid {...gridProps} />
                          <XAxis dataKey="label" {...axisProps} />
                          <YAxis {...axisProps} allowDecimals={false} width={28} />
                          <Tooltip content={<ChartTooltip />} cursor={{ stroke: CHART.track }} />
                          <Area type="monotone" dataKey="velocityPoints" name="Velocity" stroke={SERIES.velocity} strokeWidth={2.5} fill={`url(#${gradientId("rep-velocity")})`} activeDot={{ r: 4 }} />
                          <Area type="monotone" dataKey="done" name="Finalizadas" stroke={SERIES.done} strokeWidth={2} fill="transparent" activeDot={{ r: 4 }} />
                          <Area type="monotone" dataKey="merged" name="PR merg." stroke={SERIES.merged} strokeWidth={2} fill="transparent" activeDot={{ r: 4 }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-2">
                      <ChartLegend
                        items={[
                          { label: "Velocity", color: SERIES.velocity },
                          { label: "Finalizadas", color: SERIES.done },
                          { label: "PR merg.", color: SERIES.merged },
                        ]}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    Generá más reportes para ver la tendencia entre períodos.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <AutomatedAnalysis metrics={m} />

          {/* Blockers / Work by status / Recommendations */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Top blockers
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(!h?.tasksAtRisk || h.tasksAtRisk.length === 0) && (
                  <p className="text-sm text-muted-foreground">
                    Sin bloqueos ni tareas en riesgo. 🎉
                  </p>
                )}
                {h?.tasksAtRisk?.slice(0, 5).map((t) => (
                  <div key={t.externalId} className="text-sm">
                    <a href={t.url} target="_blank" rel="noreferrer" className="font-medium hover:text-primary">
                      {t.title}
                    </a>
                    <p className="text-xs text-muted-foreground">
                      {t.externalId}
                      {t.meta ? ` · ${t.meta}` : ""}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Trabajo por estado</CardTitle>
              </CardHeader>
              <CardContent>
                <WorkByStatus metrics={m} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Recomendaciones
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {(report.recommendations ?? []).map((r, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-primary">•</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Risks */}
          {report.risks && report.risks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Riesgos detectados</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {report.risks.map((r, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <Badge
                      variant={
                        r.level === "high"
                          ? "destructive"
                          : r.level === "medium"
                            ? "warning"
                            : "secondary"
                      }
                    >
                      {r.level === "high" ? "Alto" : r.level === "medium" ? "Medio" : "Bajo"}
                    </Badge>
                    <span>
                      <span className="font-medium">{r.title}</span>
                      {r.detail ? ` — ${r.detail}` : ""}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Per person */}
          {m.people.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Equipo — señales por persona</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="rounded-input bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  Métricas de proxy (no todo el trabajo se ticketea). Úsalas para
                  conversar y decidir, no como puntaje absoluto.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-2 pr-3 font-medium">#</th>
                        <th className="py-2 pr-3 font-medium">Persona</th>
                        <th className="py-2 pr-3 font-medium">Señal</th>
                        <th className="py-2 pr-3 font-medium">Score</th>
                        <th className="py-2 pr-3 font-medium">SP</th>
                        <th className="py-2 pr-3 font-medium">WIP</th>
                        <th className="py-2 pr-3 font-medium">Bloq.</th>
                        <th className="py-2 pr-3 font-medium">Próximo paso</th>
                      </tr>
                    </thead>
                    <tbody>
                      {m.people.map((p) => (
                        <tr key={p.name} className="border-b align-top last:border-0">
                          <td className="py-2 pr-3 text-muted-foreground">{p.rank}</td>
                          <td className="py-2 pr-3 font-medium">
                            <Link
                              href={`/people/${encodeURIComponent(p.name)}`}
                              className="hover:text-primary hover:underline"
                            >
                              {p.name}
                            </Link>
                          </td>
                          <td className="py-2 pr-3">
                            <Badge variant={personCategoryVariant(p.category)}>
                              {PERSON_CATEGORY_LABEL[p.category]}
                            </Badge>
                          </td>
                          <td className="py-2 pr-3">{p.score}</td>
                          <td className="py-2 pr-3">{p.completedPoints}</td>
                          <td className="py-2 pr-3">{p.wip}</td>
                          <td className="py-2 pr-3">{p.tasksBlocked}</td>
                          <td className="py-2 pr-3 text-xs text-muted-foreground">
                            {p.nextStep}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <ReportShares reportId={params.id} />
      <ReportNotes reportId={params.id} />
    </div>
  );
}

function WorkByStatus({ metrics }: { metrics: ReportMetrics }) {
  const s = metrics.statusDistribution;
  const data = [
    { name: "Finalizadas", value: s.done, color: "#16C784" },
    { name: "En progreso", value: s.inProgress, color: "#2563FF" },
    { name: "Bloqueadas", value: s.blocked, color: "#E5484D" },
    { name: "Por hacer", value: s.todo, color: "#94A3B8" },
  ].filter((d) => d.value > 0);
  const total = data.reduce((a, b) => a + b.value, 0);

  if (total === 0)
    return <p className="text-sm text-muted-foreground">Sin tareas.</p>;

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-32 w-32 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={42} outerRadius={58} paddingAngle={3} cornerRadius={5} stroke="#fff" strokeWidth={2}>
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "transparent" }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold">{total}</span>
          <span className="text-[10px] text-muted-foreground">tareas</span>
        </div>
      </div>
      <ul className="space-y-1.5 text-sm">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="text-muted-foreground">{d.name}</span>
            <span className="ml-auto font-semibold">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
