"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
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
import {
  TIER_LABEL,
  tierVariant,
  contextHypotheses,
  coachingSteps,
  COACHING_QUESTIONS,
  sustainedLow,
  type PersonProfile,
} from "@/lib/reports/people-profile";

export default function PersonProfilePage() {
  const params = useParams<{ name: string }>();
  const name = decodeURIComponent(params.name);
  const [profile, setProfile] = useState<PersonProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [ai, setAi] = useState<string | null>(null);
  const [aiErr, setAiErr] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/people/${encodeURIComponent(name)}`);
      if (res.ok) setProfile((await res.json()).profile);
      setLoading(false);
    })();
  }, [name]);

  async function coach() {
    setAiLoading(true);
    setAiErr(null);
    setAi(null);
    const res = await fetch(`/api/people/${encodeURIComponent(name)}/coach`, {
      method: "POST",
    });
    const json = await res.json().catch(() => ({}));
    setAiLoading(false);
    if (json.answer) setAi(json.answer);
    else setAiErr(json.error ?? "No se pudo generar el análisis.");
  }

  if (loading)
    return <p className="text-sm text-muted-foreground">Cargando...</p>;
  if (!profile || profile.points.length === 0)
    return (
      <div className="space-y-4">
        <BackButton />
        <p className="text-sm text-muted-foreground">
          No hay datos de {name} en los reportes de este proyecto todavía.
        </p>
      </div>
    );

  const latest = profile.latest;
  const hypotheses = contextHypotheses(latest);
  const steps = coachingSteps(profile.tier);
  const sustained = sustainedLow(profile.points.map((p) => p.tier));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <BackButton />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
            {name.charAt(0).toUpperCase()}
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{name}</h1>
            <p className="text-sm text-muted-foreground">
              Perfil de desempeño · últimos {profile.points.length} sprints
            </p>
          </div>
        </div>
        <Badge variant={tierVariant(profile.tier)}>
          {TIER_LABEL[profile.tier]}
        </Badge>
      </div>

      <p className="rounded-input bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        Clasificación tentativa a partir de proxies (tareas y PRs). Es un punto de
        partida para conversar y acompañar — no un veredicto. Validá el contexto
        antes de concluir.
      </p>

      {sustained && (
        <p
          className={`rounded-input px-3 py-2 text-sm ${
            sustained.severity === "alta"
              ? "bg-destructive/10 text-destructive"
              : "bg-amber-50 text-amber-800"
          }`}
        >
          Señal sostenida: {sustained.sprints} sprints seguidos en &quot;necesita
          apoyo&quot;. Recomendado un 1:1 y plan de acompañamiento
          {sustained.escalate
            ? "; si ya hubo acompañamiento sin mejora, evaluar escalar."
            : "."}
        </p>
      )}

      {/* Evolución */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Evolución</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={profile.points}>
                <defs>
                  <LinearGradient id={gradientId("person-tp")} color={SERIES.throughput} />
                </defs>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis {...axisProps} allowDecimals={false} width={28} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: CHART.track }} />
                <Area type="monotone" dataKey="throughput" name="Throughput" stroke={SERIES.throughput} strokeWidth={2.5} fill={`url(#${gradientId("person-tp")})`} activeDot={{ r: 4 }} />
                <Area type="monotone" dataKey="completedPoints" name="SP completados" stroke={SERIES.completedPoints} strokeWidth={2} fill="transparent" activeDot={{ r: 4 }} />
                <Area type="monotone" dataKey="blocked" name="Bloqueadas" stroke={SERIES.blocked} strokeWidth={2} fill="transparent" activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2">
            <ChartLegend
              items={[
                { label: "Throughput", color: SERIES.throughput },
                { label: "SP completados", color: SERIES.completedPoints },
                { label: "Bloqueadas", color: SERIES.blocked },
              ]}
            />
          </div>
        </CardContent>
      </Card>

      {latest && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Último sprint</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Finalizadas" value={latest.tasksDone} />
            <Stat label="SP completados" value={latest.completedPoints} />
            <Stat label="WIP" value={latest.wip} />
            <Stat label="Bloqueadas" value={latest.tasksBlocked} />
            <Stat label="PR mergeados" value={latest.prsMerged} />
            <Stat label="Sin movimiento" value={latest.tasksStale} />
            <Stat label="Throughput" value={latest.throughput} />
            <Stat label="Tendencia" value={profile.trend === "up" ? "▲" : profile.trend === "down" ? "▼" : "="} />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Posibles hipótesis de contexto</CardTitle>
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
            <CardTitle className="text-lg">Plan de acompañamiento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ul className="list-disc space-y-1.5 pl-5">
              {steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
            <div>
              <p className="font-medium">Preguntas para el 1:1</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                {COACHING_QUESTIONS.slice(0, 5).map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      <PersonContextForm name={name} />

      {/* AI 1:1 (Pro) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Análisis 1:1 con IA (Pro)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={coach} disabled={aiLoading}>
            {aiLoading ? "Generando..." : "Generar análisis 1:1"}
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
            La IA usa solo los datos de desempeño de la persona en el proyecto.
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
