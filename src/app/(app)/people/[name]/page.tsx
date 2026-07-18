"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  Area,
  AreaChart,
  CartesianGrid,
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BackButton } from "@/components/back-button";
import { PersonContextForm } from "@/components/person-context-form";
import { useT } from "@/components/i18n-provider";
import {
  tierVariant,
  contextHypotheses,
  coachingSteps,
  COACHING_QUESTION_KEYS,
  sustainedLow,
  type PersonProfile,
} from "@/lib/reports/people-profile";
import type { EvaluationConfidence } from "@/lib/reports/evaluation-confidence";
import type { PersonSelfComparison } from "@/lib/reports/person-history";
import { formatMetric, type MetricValue } from "@/lib/reports/metric-value";
import type { EvaluationBreakdown } from "@/lib/reports/evaluation-dimensions";

interface GatedVerdictDTO {
  show: boolean;
  tier: string | null;
  fixFirst: string[];
}

interface IntegrationAccountDTO {
  provider: string;
  externalUserId: string | null;
  username: string | null;
  email: string | null;
  verified: boolean;
  mappingSource: string;
}

interface IdentityDTO {
  participantId: string;
  projectId: string;
  displayName: string;
  primaryEmail: string | null;
  emailAliases: string[];
  integrationAccounts: IntegrationAccountDTO[];
  found: boolean;
  periodsMatched: number;
}

export default function PersonProfilePage() {
  const { t } = useT();
  const params = useParams<{ name: string }>();
  const search = useSearchParams();
  const name = decodeURIComponent(params.name);
  // Scope explícito: el detalle pertenece al proyecto del reporte, no al activo.
  const projectId = search.get("projectId") ?? undefined;
  // Clave de selección estable: incluye projectId para no reusar datos de otro
  // proyecto ni de otra persona (evita mezclas / caché cruzada).
  const selectionKey = `${projectId ?? "active"}::${name}`;
  const [profile, setProfile] = useState<PersonProfile | null>(null);
  const [identity, setIdentity] = useState<IdentityDTO | null>(null);
  const [metricStates, setMetricStates] = useState<Record<string, MetricValue> | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationBreakdown | null>(null);
  const [confidence, setConfidence] = useState<EvaluationConfidence | null>(null);
  const [selfComparison, setSelfComparison] = useState<PersonSelfComparison | null>(null);
  const [verdict, setVerdict] = useState<GatedVerdictDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Clave a la que pertenecen los datos actualmente en estado. Si no coincide con
  // la selección vigente, los datos son STALE y NO se renderizan (evita mostrar
  // a otra persona durante la carga o el cambio de selección).
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [ai, setAi] = useState<string | null>(null);
  const [aiErr, setAiErr] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    // Limpieza del estado anterior antes de renderizar el nuevo participante.
    setProfile(null);
    setIdentity(null);
    setMetricStates(null);
    setEvaluation(null);
    setConfidence(null);
    setSelfComparison(null);
    setVerdict(null);
    setAi(null);
    setAiErr(null);
    const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
    (async () => {
      try {
        const res = await fetch(`/api/people/${encodeURIComponent(name)}${qs}`, {
          signal: controller.signal,
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error ?? t("ws.people.loadError"));
        setProfile(json.profile);
        setIdentity(json.identity ?? null);
        setMetricStates(json.metricStates ?? null);
        setEvaluation(json.evaluation ?? null);
        setConfidence(json.confidence ?? null);
        setSelfComparison(json.selfComparison ?? null);
        setVerdict(json.verdict ?? null);
        setLoadedFor(selectionKey); // los datos ya pertenecen a esta selección
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError(err instanceof Error ? err.message : t("ws.people.netError"));
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
    // `t` es estable (useMemo en el provider); sólo re-corre si cambia el idioma.
  }, [selectionKey, name, projectId, t]);

  async function coach() {
    setAiLoading(true);
    setAiErr(null);
    setAi(null);
    const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
    const res = await fetch(`/api/people/${encodeURIComponent(name)}/coach${qs}`, {
      method: "POST",
    });
    const json = await res.json().catch(() => ({}));
    setAiLoading(false);
    if (json.answer) setAi(json.answer);
    else setAiErr(json.error ?? t("ws.people.aiError"));
  }

  // Datos stale (de otra selección) o cargando → skeleton, NUNCA datos ajenos.
  if (loading || loadedFor !== selectionKey)
    return (
      <p data-testid="person-loading" className="text-sm text-muted-foreground">
        {t("ws.people.loading")}
      </p>
    );
  if (error)
    return (
      <div className="space-y-4">
        <BackButton />
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  if (!profile || profile.points.length === 0)
    return (
      <div className="space-y-4">
        <BackButton />
        <p className="text-sm text-muted-foreground">
          {`${t("ws.people.noDataPrefix")} ${name} ${t("ws.people.noDataSuffix")}`}
        </p>
      </div>
    );

  // Nombre para MOSTRAR: el resuelto por la API (nunca el id crudo de la URL).
  const displayName = profile.name || identity?.displayName || name;
  // Formatea una métrica respetando su estado (§6): 0 real vs Sin datos vs No
  // vinculada, etc. Nunca muestra "0" cuando en realidad faltan datos.
  const mv = (key: string, raw: number): string =>
    metricStates && metricStates[key] ? formatMetric(metricStates[key], t) : String(raw);
  const latest = profile.latest;
  const hypotheses = contextHypotheses(latest, t);
  const steps = coachingSteps(profile.tier, t);
  const sustained = sustainedLow(profile.points.map((p) => p.tier));

  // Gráfico de evolución: preferimos la línea DENTRO del período (por días) del
  // último reporte, que muestra el avance a lo largo de los días. Si el reporte
  // es viejo y no tiene timeline por persona, caemos a la comparación entre
  // reportes (un punto por sprint).
  const withinPeriod = latest?.timeline ?? [];
  const usesTimeline = withinPeriod.length >= 2;
  const chartData = usesTimeline
    ? withinPeriod.map((tp) => ({
        label: tp.label,
        throughput: tp.done + tp.merged,
        completedPoints: tp.velocityPoints,
        blocked: tp.blocked,
      }))
    : profile.points;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <BackButton />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
            {displayName.charAt(0).toUpperCase()}
          </span>
          <div>
            <h1
              data-testid="person-name"
              data-participant-id={identity?.participantId ?? ""}
              className="text-2xl font-bold tracking-tight"
            >
              {displayName}
            </h1>
            <p className="text-sm text-muted-foreground">
              {`${t("ws.people.perfProfilePrefix")} ${profile.points.length} ${t("ws.people.perfProfileSuffix")}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {confidence && (
            <Badge
              variant={
                confidence.level === "high"
                  ? "success"
                  : confidence.level === "medium"
                    ? "secondary"
                    : "warning"
              }
              title={`${t("ws.people.confidence.title")}: ${confidence.score}/100`}
            >
              {t("ws.people.confidence.title")}: {t(`ws.people.confidence.${confidence.level}`)}
            </Badge>
          )}
          {/* Con confianza baja NO se muestra veredicto categórico (spec §7). */}
          {(!verdict || verdict.show) && (
            <Badge variant={tierVariant(profile.tier)}>
              {t(`lib.tier.${profile.tier}`)}
            </Badge>
          )}
        </div>
      </div>

      <p className="rounded-input bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        {t("ws.people.disclaimer")}
      </p>

      {/* Confianza baja: en vez de un veredicto categórico, qué corregir. */}
      {verdict && !verdict.show && verdict.fixFirst.length > 0 && (
        <div className="rounded-input border border-warning/40 bg-warning-soft px-3 py-2 text-sm text-warning">
          <p className="font-medium">{t("ws.people.confidence.lowVerdict")}</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {verdict.fixFirst.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Identidad / procedencia: quién es y por qué está vinculado así */}
      {identity && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("ws.people.identity.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <span className="text-muted-foreground">
                {t("ws.people.identity.id")}:{" "}
                <span className="font-mono text-[11px] text-foreground">
                  {identity.participantId}
                </span>
              </span>
              <span className="text-muted-foreground">
                {t("ws.people.identity.email")}:{" "}
                <span className="text-foreground">
                  {identity.primaryEmail ?? t("ws.people.identity.noEmail")}
                </span>
              </span>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium">{t("ws.people.identity.accounts")}</p>
              {identity.integrationAccounts.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {t("ws.people.identity.none")}
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {identity.integrationAccounts.map((a, i) => (
                    <Badge key={i} variant={a.verified ? "success" : "warning"}>
                      {a.provider}
                      {a.externalUserId ? ` · ${a.externalUserId}` : ""} ·{" "}
                      {a.verified
                        ? t("ws.people.identity.verified")
                        : t("ws.people.identity.suggested")}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confianza de la evaluación + evolución vs período propio */}
      {(confidence || selfComparison?.comparable) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {confidence && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("ws.people.confidence.title")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <ConfBar label={t("ws.people.confidence.mapping")} value={confidence.participantMappingCoverage} />
                <ConfBar label={t("ws.people.confidence.completeness")} value={confidence.dataCompleteness} />
                <ConfBar label={t("ws.people.confidence.traceability")} value={confidence.traceabilityCoverage} />
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-xs text-muted-foreground">
                    {t("ws.people.confidence.connected")}:
                  </span>
                  {confidence.connectedIntegrations.length ? (
                    confidence.connectedIntegrations.map((c) => (
                      <Badge key={c} variant="success">
                        {t(`ws.eval.cat.${c}`)}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {t("ws.people.confidence.none")}
                    </span>
                  )}
                </div>
                {confidence.missingIntegrations.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-xs text-muted-foreground">
                      {t("ws.people.confidence.missing")}:
                    </span>
                    {confidence.missingIntegrations.map((c) => (
                      <Badge key={c} variant="warning">
                        {t(`ws.eval.cat.${c}`)}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {selfComparison?.comparable && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  {t("ws.people.self.title")}
                  <Badge
                    variant={
                      selfComparison.trend === "up"
                        ? "success"
                        : selfComparison.trend === "down"
                          ? "warning"
                          : "secondary"
                    }
                  >
                    {t(`ws.people.self.${selfComparison.trend}`)}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                {selfComparison.deltas.map((d) => (
                  <div key={d.metric} className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      {t(`ws.people.${metricKey(d.metric)}`)}
                    </span>
                    <span
                      className={
                        d.sentiment === "good"
                          ? "text-success"
                          : d.sentiment === "bad"
                            ? "text-destructive"
                            : "text-muted-foreground"
                      }
                    >
                      {d.previous} → {d.current}{" "}
                      {d.direction === "up" ? "▲" : d.direction === "down" ? "▼" : "="}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {sustained && (
        <p
          className={`rounded-input px-3 py-2 text-sm ${
            sustained.severity === "alta"
              ? "bg-destructive/10 text-destructive"
              : "bg-warning-soft text-warning"
          }`}
        >
          {`${t("ws.people.sustainedPrefix")} ${sustained.sprints} ${t("ws.people.sustainedMid")}`}
          {sustained.escalate
            ? t("ws.people.sustainedEscalate")
            : "."}
        </p>
      )}

      {/* Evolución */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("ws.people.evolution")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <LinearGradient id={gradientId("person-tp")} color={SERIES.throughput} />
                </defs>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis {...axisProps} allowDecimals={false} width={28} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: CHART.track }} />
                <Area type="monotone" dataKey="throughput" name={t("ws.people.throughput")} stroke={SERIES.throughput} strokeWidth={2.5} fill={`url(#${gradientId("person-tp")})`} activeDot={{ r: 4 }} />
                <Area type="monotone" dataKey="completedPoints" name={t("ws.people.completedPoints")} stroke={SERIES.completedPoints} strokeWidth={2} fill="transparent" activeDot={{ r: 4 }} />
                <Area type="monotone" dataKey="blocked" name={t("ws.people.blocked")} stroke={SERIES.blocked} strokeWidth={2} fill="transparent" activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2">
            <ChartLegend
              items={[
                { label: t("ws.people.throughput"), color: SERIES.throughput },
                { label: t("ws.people.completedPoints"), color: SERIES.completedPoints },
                { label: t("ws.people.blocked"), color: SERIES.blocked },
              ]}
            />
          </div>
        </CardContent>
      </Card>

      {latest && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("ws.people.lastSprint")}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label={t("ws.people.done")} value={mv("tasksDone", latest.tasksDone)} />
            <Stat label={t("ws.people.completedPoints")} value={mv("completedPoints", latest.completedPoints)} />
            <Stat label={t("ws.people.wip")} value={mv("wip", latest.wip)} />
            <Stat label={t("ws.people.blocked")} value={mv("tasksBlocked", latest.tasksBlocked)} />
            <Stat label={t("ws.people.prsMerged")} value={mv("prsMerged", latest.prsMerged)} />
            <Stat label={t("ws.people.stale")} value={mv("tasksStale", latest.tasksStale)} />
            <Stat label={t("ws.people.throughput")} value={mv("throughput", latest.throughput)} />
            <Stat label={t("ws.people.trend")} value={profile.trend === "up" ? "▲" : profile.trend === "down" ? "▼" : "="} />
          </CardContent>
        </Card>
      )}

      {/* Evaluación multidimensional (§8) */}
      {evaluation && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-lg">{t("ws.eval.dim.title")}</CardTitle>
              {evaluation.sufficient && evaluation.overall != null && (
                <Badge variant="secondary">
                  {t("ws.eval.overall")}: {evaluation.overall}/100
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {!evaluation.sufficient && (
              <p className="rounded-input bg-warning-soft px-3 py-2 text-warning">
                {t("ws.eval.insufficient")}
              </p>
            )}
            {evaluation.dimensions.map((d) => (
              <div key={d.key}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-muted-foreground" title={d.formula}>
                    {t(`ws.eval.dim.${d.key}`)}
                  </span>
                  <span className="font-medium">
                    {d.available && d.score != null
                      ? `${d.score}/100`
                      : t("ws.eval.noData")}
                  </span>
                </div>
                {d.available && d.score != null ? (
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${
                        d.score >= 70 ? "bg-success" : d.score >= 45 ? "bg-warning" : "bg-destructive"
                      }`}
                      style={{ width: `${d.score}%` }}
                    />
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">{d.evidence[0]}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("ws.people.hypotheses")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
              {hypotheses.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("ws.people.coachingPlan")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ul className="list-disc space-y-1.5 pl-5">
              {steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
            <div>
              <p className="font-medium">{t("ws.people.oneOnOneQuestions")}</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                {COACHING_QUESTION_KEYS.slice(0, 5).map((q, i) => (
                  <li key={i}>{t(q)}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      <PersonContextForm name={displayName} />

      {/* AI 1:1 (Pro) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("ws.people.aiTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={coach} disabled={aiLoading}>
            {aiLoading ? t("ws.people.aiGenerating") : t("ws.people.aiGenerate")}
          </Button>
          {aiErr && (
            <p className="rounded-input bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {aiErr}
            </p>
          )}
          {ai && (
            <div className="rounded-input border bg-muted/40 p-3">
              <p className="whitespace-pre-wrap text-sm">{ai}</p>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            {t("ws.people.aiNote")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-input border p-3">
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

/** Barra 0..1 para una dimensión de confianza. */
function ConfBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const tone = pct >= 70 ? "bg-success" : pct >= 45 ? "bg-warning" : "bg-destructive";
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{pct}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Mapea la métrica del delta a la clave i18n existente de ws.people.*. */
function metricKey(metric: string): string {
  switch (metric) {
    case "tasksDone":
      return "done";
    case "completedPoints":
      return "completedPoints";
    case "blocked":
      return "blocked";
    case "stale":
      return "stale";
    default:
      return "throughput";
  }
}
