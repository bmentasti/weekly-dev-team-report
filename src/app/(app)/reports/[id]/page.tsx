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
import { formatDate } from "@/lib/utils";
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
import { useT } from "@/components/i18n-provider";
import { healthBadgeVariant } from "@/lib/reports/health";
import { personCategoryVariant } from "@/lib/reports/labels";
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
  t,
}: {
  value: number;
  health: HealthLevel | null;
  t: (k: string) => string;
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
          <p className="text-xs text-muted-foreground">{t("rep.teamHealth")}</p>
          <Badge variant={healthBadgeVariant(health)}>
            {health ? t(`lib.health.${health}`) : "—"}
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
  const { t } = useT();
  const { confirm, alert: alertDialog } = useDialogs();
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
        if (!res.ok) setError(json.error ?? t("rep.couldNotLoadReport"));
        else {
          setReport(json.report);
          setPeopleHidden(json.access && json.access.canViewPeople === false);
        }
      } catch {
        setError(t("rep.networkLoadReportError"));
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id, t]);

  async function copyMarkdown() {
    if (!report?.rawData?.markdown) return;
    await navigator.clipboard.writeText(report.rawData.markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function deleteReport() {
    const ok = await confirm({
      title: t("rep.deleteReport"),
      description: t("rep.deleteCannotUndo"),
      confirmLabel: t("rep.deleteConfirmLabel"),
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/reports/${params.id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? t("rep.couldNotDeleteReport"));
      }
      router.push("/reports");
      router.refresh();
    } catch (err) {
      await alertDialog({
        title: t("rep.couldNotDelete"),
        description:
          err instanceof Error ? err.message : t("rep.deleteRetry"),
      });
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">{t("rep.loadingReport")}</p>;
  if (error || !report)
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" asChild>
          <Link href="/reports">{t("rep.backToReports")}</Link>
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
      <BackButton label={t("rep.backToReports")} />
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t("rep.teamReport")}
          </h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            {formatDate(report.periodStart)} –{" "}
            {formatDate(report.periodEnd)} ({days} {t("rep.daysSuffix")})
            <Badge variant={healthBadgeVariant(report.healthStatus)}>
              {report.healthStatus ? t(`lib.health.${report.healthStatus}`) : "—"}
            </Badge>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={copyMarkdown}>
            {copied ? t("rep.copied") : t("rep.copyText")}
          </Button>
          <Button variant="outline" asChild>
            <a href={`/api/reports/${params.id}/export`}>{t("rep.exportCsv")}</a>
          </Button>
          <Button onClick={() => setShowEmail((v) => !v)}>
            {t("rep.sendByEmail")}
          </Button>
          <Button
            variant="ghost"
            onClick={deleteReport}
            className="text-muted-foreground hover:text-destructive"
          >
            {t("rep.delete")}
          </Button>
        </div>
      </div>

      {report.rawData?.sourcesWithError &&
        report.rawData.sourcesWithError.length > 0 && (
          <p className="rounded-input bg-warning-soft px-3 py-2 text-sm text-warning">
            {t("rep.someSourcesFailedPre")} {report.rawData.sourcesWithError.join(", ")}.
          </p>
        )}

      {m?.scope && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Alcance del sprint</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
              {[
                ["Tareas únicas del período", m.scope.uniqueTasks],
                ["Comprometidas", m.scope.committed],
                ["Incorporadas en el sprint", m.scope.addedDuringSprint],
                ["Completadas", m.scope.completed],
                ["En progreso", m.scope.inProgress],
                ["Bloqueadas", m.scope.blocked],
                ["Trasladadas (no cerradas)", m.scope.carriedOver],
                ["Cumplimiento comprometido", `${m.scope.commitmentCompletionPct}%`],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className="text-lg font-semibold tabular-nums">{value}</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Trazabilidad del recorte: {m.scope.excludedOutOfPeriod} fuera de la
              ventana (backlog / otros sprints), {m.scope.insufficientData} sin
              fechas para ubicarlas, {m.scope.duplicatesCollapsed} duplicados
              unificados. Última sincronización con la fuente:{" "}
              {new Date(m.scope.lastSyncedAt).toLocaleString("es-AR")}.
            </p>
            {(m.scope.insufficientData > 0 || m.scope.duplicatesCollapsed > 0) && (
              <p className="rounded-input bg-warning-soft px-3 py-2 text-xs text-warning">
                Advertencia de calidad de datos:{" "}
                {m.scope.insufficientData > 0 &&
                  `${m.scope.insufficientData} tarea(s) no tienen fechas suficientes y se excluyen de los cálculos del sprint. `}
                {m.scope.duplicatesCollapsed > 0 &&
                  `${m.scope.duplicatesCollapsed} registro(s) duplicado(s) fueron unificados por su ID estable. `}
                Revisá los campos de fecha en Airtable para mejorar la precisión.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {showEmail && <EmailReport reportId={params.id} />}

      {report.rawData?.aiAnalysis && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-4 w-4 text-primary" />
              {t("rep.aiAnalysis")}
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
            <div className="rounded-input border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
              {t("rep.peopleHidden")}
            </div>
          )}

          {/* KPI row */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <Kpi
              label={t("rep.kpiTasksDone")}
              value={m.workItems.done}
              sub={`${t("rep.kpiOfTotalPre")} ${m.workItems.total} ${t("rep.kpiOfTotalPost")}`}
            />
            <Kpi label={t("rep.kpiPrMerged")} value={m.codeChanges.merged} />
            <Kpi
              label={t("rep.kpiCycleTime")}
              value={
                m.capacity.cycleTimeAvgDays != null
                  ? `${m.capacity.cycleTimeAvgDays}d`
                  : "—"
              }
            />
            <Kpi label={t("rep.kpiTasksBlocked")} value={m.workItems.blocked} />
            <ScoreDonut
              value={m.projectProgress.completionByPoints}
              health={report.healthStatus}
              t={t}
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
                  {t("rep.summarySprint")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <p className="text-sm">{report.summary}</p>
                <div className="grid grid-cols-3 gap-3">
                  <SummaryStat
                    icon={Rocket}
                    label={t("rep.summaryCommitted")}
                    value={`${m.capacity.committedPoints} ${t("rep.pts")}`}
                    tint="#2563FF"
                  />
                  <SummaryStat
                    icon={CheckCircle2}
                    label={t("rep.summaryCompleted")}
                    value={`${m.projectProgress.completionByPoints}%`}
                    sub={`${m.capacity.completedPoints} ${t("rep.pts")}`}
                    tint="#16C784"
                  />
                  <SummaryStat
                    icon={Clock}
                    label={t("rep.summaryCarryOver")}
                    value={`${m.planning.carryOverPoints} ${t("rep.pts")}`}
                    sub={`${m.planning.carryOverItems} ${t("rep.carryOverTasksSuffix")}`}
                    tint="#F5A623"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t("rep.trend")}</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Preferimos la evolución interna del período (timeline: fechas
                    de corte cada ~15 días, siempre distintas). Los reportes
                    generados antes de esta versión no la tienen y caen al
                    histórico entre reportes (trend). */}
                {report.rawData &&
                ((m.timeline && m.timeline.length >= 2) || m.trend.length >= 2) ? (
                  <div>
                    <div className="h-48 sm:h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={
                            m.timeline && m.timeline.length >= 2
                              ? m.timeline
                              : m.trend
                          }
                        >
                          <defs>
                            <LinearGradient id={gradientId("rep-velocity")} color={SERIES.velocity} />
                          </defs>
                          <CartesianGrid {...gridProps} />
                          <XAxis dataKey="label" {...axisProps} />
                          <YAxis {...axisProps} allowDecimals={false} width={28} />
                          <Tooltip content={<ChartTooltip />} cursor={{ stroke: CHART.track }} />
                          <Area type="monotone" dataKey="velocityPoints" name={t("rep.seriesVelocity")} stroke={SERIES.velocity} strokeWidth={2.5} fill={`url(#${gradientId("rep-velocity")})`} activeDot={{ r: 4 }} />
                          <Area type="monotone" dataKey="done" name={t("rep.seriesDone")} stroke={SERIES.done} strokeWidth={2} fill="transparent" activeDot={{ r: 4 }} />
                          <Area type="monotone" dataKey="merged" name={t("rep.seriesMerged")} stroke={SERIES.merged} strokeWidth={2} fill="transparent" activeDot={{ r: 4 }} />
                          <Area type="monotone" dataKey="blocked" name={t("rep.seriesBlocked")} stroke={SERIES.blocked} strokeWidth={2} fill="transparent" activeDot={{ r: 4 }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-2">
                      <ChartLegend
                        items={[
                          { label: t("rep.seriesVelocity"), color: SERIES.velocity },
                          { label: t("rep.seriesDone"), color: SERIES.done },
                          { label: t("rep.seriesMerged"), color: SERIES.merged },
                          { label: t("rep.seriesBlocked"), color: SERIES.blocked },
                        ]}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    {t("rep.trendEmpty")}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <AutomatedAnalysis metrics={m} />

          {/* Blockers / Work by status / PR review / Recommendations */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  {t("rep.topBlockers")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(!h?.tasksAtRisk || h.tasksAtRisk.length === 0) && (
                  <p className="text-sm text-muted-foreground">
                    {t("rep.noBlockers")}
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
                <CardTitle className="text-lg">{t("rep.workByStatus")}</CardTitle>
              </CardHeader>
              <CardContent>
                <WorkByStatus metrics={m} t={t} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t("rep.prReviewTitle")}</CardTitle>
              </CardHeader>
              <CardContent>
                <PrReviewStatus metrics={m} t={t} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="h-4 w-4 text-primary" />
                  {t("rep.recommendations")}
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
                <CardTitle className="text-lg">{t("rep.risksDetected")}</CardTitle>
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
                      {r.level === "high" ? t("rep.riskHigh") : r.level === "medium" ? t("rep.riskMedium") : t("rep.riskLow")}
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
                <CardTitle className="text-lg">{t("rep.teamSignalsPerPerson")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="rounded-input bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  {t("rep.proxyMetricsNote")}
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" aria-label={t("rep.signalsPerPersonLabel")}>
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th scope="col" className="py-2 pr-3 font-medium">#</th>
                        <th scope="col" className="py-2 pr-3 font-medium">{t("rep.colPerson")}</th>
                        <th scope="col" className="py-2 pr-3 font-medium">{t("rep.colSignal")}</th>
                        <th scope="col" className="py-2 pr-3 font-medium">{t("rep.colScore")}</th>
                        <th scope="col" className="py-2 pr-3 font-medium">{t("rep.colSP")}</th>
                        <th scope="col" className="py-2 pr-3 font-medium">{t("rep.colWIP")}</th>
                        <th scope="col" className="py-2 pr-3 font-medium">{t("rep.colBlockedShort")}</th>
                        <th scope="col" className="py-2 pr-3 font-medium">{t("rep.colNextStep")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {m.people.map((p) => (
                        <tr key={p.name} className="border-b align-top last:border-0">
                          <td className="py-2 pr-3 text-muted-foreground">{p.rank}</td>
                          <td className="py-2 pr-3 font-medium">
                            <Link
                              // Selección por ID canónico ESTABLE (no por nombre)
                              // + scope al proyecto del reporte, para que el
                              // detalle corresponda exactamente a esta persona y
                              // a este proyecto (evita colisiones de homónimos y
                              // datos de otro proyecto).
                              data-testid="participant-link"
                              data-participant-id={p.id ?? p.name}
                              href={`/people/${encodeURIComponent(p.id ?? p.name)}${
                                report.projectId
                                  ? `?projectId=${encodeURIComponent(report.projectId)}`
                                  : ""
                              }`}
                              className="hover:text-primary hover:underline"
                            >
                              {p.name}
                            </Link>
                          </td>
                          <td className="py-2 pr-3">
                            <Badge variant={personCategoryVariant(p.category)}>
                              {t(`lib.personCategory.${p.category}`)}
                            </Badge>
                            {p.categoryReason && (
                              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                                {p.categoryReason}
                              </p>
                            )}
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

/**
 * Composición de review de los PR/MR abiertos: con reviewer asignado vs
 * "sin reviewer / re-review" (nunca asignado, o esperando nueva revisión tras
 * cambios solicitados — GitHub vacía requested_reviewers al enviar la review).
 * Checks fallando y +72h se muestran aparte porque se superponen con ambos.
 */
function PrReviewStatus({ metrics, t }: { metrics: ReportMetrics; t: (k: string) => string }) {
  const cc = metrics.codeChanges;
  const awaiting = cc.withoutReviewer;
  const withReviewer = Math.max(cc.open - awaiting, 0);
  const data = [
    { name: t("rep.prWithReviewer"), value: withReviewer, color: "#16C784" },
    { name: t("rep.rvWithoutReviewer"), value: awaiting, color: "#F5A623" },
  ].filter((d) => d.value > 0);

  if (cc.open === 0)
    return <p className="text-sm text-muted-foreground">{t("rep.noPrsOpen")}</p>;

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
          <span className="text-lg font-bold">{cc.open}</span>
          <span className="text-[10px] text-muted-foreground">{t("rep.prOpenShort")}</span>
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
        <li className="flex items-center gap-2 border-t pt-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#E5484D" }} />
          <span className="text-muted-foreground">{t("rep.rvChecksFailing")}</span>
          <span className="ml-auto font-semibold">{cc.checksFailing}</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#94A3B8" }} />
          <span className="text-muted-foreground">{t("rep.rvOpen72h")}</span>
          <span className="ml-auto font-semibold">{cc.old}</span>
        </li>
      </ul>
    </div>
  );
}

function WorkByStatus({ metrics, t }: { metrics: ReportMetrics; t: (k: string) => string }) {
  const s = metrics.statusDistribution;
  const data = [
    { name: t("rep.statusDone"), value: s.done, color: "#16C784" },
    { name: t("rep.statusInProgress"), value: s.inProgress, color: "#2563FF" },
    { name: t("rep.statusBlocked"), value: s.blocked, color: "#E5484D" },
    { name: t("rep.statusTodo"), value: s.todo, color: "#94A3B8" },
  ].filter((d) => d.value > 0);
  const total = data.reduce((a, b) => a + b.value, 0);

  if (total === 0)
    return <p className="text-sm text-muted-foreground">{t("rep.noTasks")}</p>;

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
          <span className="text-[10px] text-muted-foreground">{t("rep.tasks")}</span>
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
