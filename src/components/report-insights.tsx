"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReportMetrics } from "@/lib/reports/types";
import {
  PERSON_CATEGORY_LABEL,
  personCategoryVariant,
} from "@/lib/reports/labels";
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

const COLORS = {
  done: SERIES.done,
  inProgress: SERIES.inProgress,
  blocked: SERIES.blocked,
  todo: SERIES.todo,
  velocity: SERIES.velocity,
  merged: SERIES.merged,
};

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-success transition-all"
        style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }}
      />
    </div>
  );
}

export function ReportInsights({ metrics }: { metrics: ReportMetrics }) {
  const { capacity, projectProgress, statusDistribution, planning, trend } =
    metrics;

  const statusData = [
    { name: "Finalizadas", value: statusDistribution.done, color: COLORS.done },
    {
      name: "En progreso",
      value: statusDistribution.inProgress,
      color: COLORS.inProgress,
    },
    { name: "Bloqueadas", value: statusDistribution.blocked, color: COLORS.blocked },
    { name: "Por hacer", value: statusDistribution.todo, color: COLORS.todo },
  ].filter((d) => d.value > 0);

  const peopleChart = metrics.people
    .slice(0, 10)
    .map((p) => ({
      name: p.name,
      "SP completados": p.completedPoints,
      Throughput: p.throughput,
    }));

  const showTrend = trend.length >= 2;

  return (
    <div className="space-y-6">
      {/* Avance del proyecto */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Avance del proyecto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <div>
                <div className="mb-1 flex justify-between text-sm">
                  <span>Por story points</span>
                  <span className="font-medium">
                    {projectProgress.completionByPoints}%
                  </span>
                </div>
                <ProgressBar pct={projectProgress.completionByPoints} />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-sm">
                  <span>Por tareas</span>
                  <span className="font-medium">
                    {projectProgress.completionByCount}%
                  </span>
                </div>
                <ProgressBar pct={projectProgress.completionByCount} />
              </div>
              <p className="text-xs text-muted-foreground">
                {projectProgress.doneItems} de {projectProgress.totalItems} tareas
                finalizadas.
              </p>
            </div>
            {statusData.length > 0 && (
              <div>
                <div className="relative h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={52}
                        outerRadius={76}
                        paddingAngle={3}
                        cornerRadius={6}
                        stroke="#fff"
                        strokeWidth={2}
                      >
                        {statusData.map((d) => (
                          <Cell key={d.name} fill={d.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={<ChartTooltip />}
                        cursor={{ fill: "transparent" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-navy">
                      {statusData.reduce((a, d) => a + d.value, 0)}
                    </span>
                    <span className="text-[11px] text-muted-foreground">tareas</span>
                  </div>
                </div>
                <div className="mt-2">
                  <ChartLegend
                    items={statusData.map((d) => ({ label: d.name, color: d.color }))}
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Capacidad y velocity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Capacidad y velocity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat
              label="SP completados"
              value={capacity.completedPoints}
              sub={`de ${capacity.committedPoints} comprometidos`}
            />
            <Stat label="Velocity" value={`${capacity.velocityPoints} pts`} />
            <Stat label="Restantes" value={`${capacity.remainingPoints} pts`} />
            <Stat
              label="Cycle time"
              value={
                capacity.cycleTimeAvgDays != null
                  ? `${capacity.cycleTimeAvgDays} d`
                  : "—"
              }
            />
          </div>
          {peopleChart.length > 0 && (
            <div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={peopleChart} barGap={6}>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="name" {...axisProps} />
                    <YAxis {...axisProps} allowDecimals={false} width={28} />
                    <Tooltip
                      content={<ChartTooltip />}
                      cursor={{ fill: CHART.grid }}
                    />
                    <Bar dataKey="SP completados" fill={SERIES.completedPoints} radius={[6, 6, 0, 0]} maxBarSize={26} />
                    <Bar dataKey="Throughput" fill={SERIES.throughput} radius={[6, 6, 0, 0]} maxBarSize={26} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2">
                <ChartLegend
                  items={[
                    { label: "SP completados", color: SERIES.completedPoints },
                    { label: "Throughput", color: SERIES.throughput },
                  ]}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tendencia */}
      {showTrend && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tendencia vs semanas previas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend}>
                  <defs>
                    <LinearGradient id={gradientId("velocity")} color={SERIES.velocity} />
                  </defs>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="label" {...axisProps} />
                  <YAxis {...axisProps} allowDecimals={false} width={28} />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: CHART.track }} />
                  <Area
                    type="monotone"
                    dataKey="velocityPoints"
                    name="Velocity"
                    stroke={SERIES.velocity}
                    strokeWidth={2.5}
                    fill={`url(#${gradientId("velocity")})`}
                    activeDot={{ r: 4 }}
                  />
                  <Area type="monotone" dataKey="done" name="Finalizadas" stroke={SERIES.done} strokeWidth={2} fill="transparent" activeDot={{ r: 4 }} />
                  <Area type="monotone" dataKey="merged" name="PR merg." stroke={SERIES.merged} strokeWidth={2} fill="transparent" activeDot={{ r: 4 }} />
                  <Area type="monotone" dataKey="blocked" name="Bloqueadas" stroke={SERIES.blocked} strokeWidth={2} fill="transparent" activeDot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2">
              <ChartLegend
                items={[
                  { label: "Velocity", color: SERIES.velocity },
                  { label: "Finalizadas", color: SERIES.done },
                  { label: "PR merg.", color: SERIES.merged },
                  { label: "Bloqueadas", color: SERIES.blocked },
                ]}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Insumos para planning */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Insumos para el próximo planning</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Carry-over" value={`${planning.carryOverItems} tareas`} sub={`${planning.carryOverPoints} pts sin terminar`} />
            <Stat label="Forecast" value={`~${planning.forecastPoints} pts`} sub="capacidad estimada" />
            <Stat label="Foco" value={planning.focus.length} sub="ítems a priorizar" />
          </div>
          {planning.focus.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold">Foco recomendado</h3>
              <ul className="space-y-1 text-sm">
                {planning.focus.map((f) => (
                  <li key={f.externalId}>
                    <a href={f.url} target="_blank" rel="noreferrer" className="font-mono text-xs text-primary hover:underline">
                      {f.externalId}
                    </a>{" "}
                    — {f.title}{" "}
                    <Badge variant="warning">{f.reason}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Insights individuales */}
      {metrics.people.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Equipo — señales por persona</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              Estas métricas son proxies (no todo el trabajo se ticketea y los
              story points varían entre equipos). Sirven como punto de partida
              para conversar y decidir — no como un puntaje absoluto de desempeño.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">#</th>
                    <th className="py-2 pr-3 font-medium">Persona</th>
                    <th className="py-2 pr-3 font-medium">Señal</th>
                    <th className="py-2 pr-3 font-medium">Score</th>
                    <th className="py-2 pr-3 font-medium">SP compl.</th>
                    <th className="py-2 pr-3 font-medium">WIP</th>
                    <th className="py-2 pr-3 font-medium">Bloq.</th>
                    <th className="py-2 pr-3 font-medium">PR merg.</th>
                    <th className="py-2 pr-3 font-medium">Próximo paso</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.people.map((p) => (
                    <tr key={p.name} className="border-b last:border-0 align-top">
                      <td className="py-2 pr-3 text-muted-foreground">{p.rank}</td>
                      <td className="py-2 pr-3 font-medium">{p.name}</td>
                      <td className="py-2 pr-3">
                        <Badge variant={personCategoryVariant(p.category)}>
                          {PERSON_CATEGORY_LABEL[p.category]}
                        </Badge>
                      </td>
                      <td className="py-2 pr-3">{p.score}</td>
                      <td className="py-2 pr-3">{p.completedPoints}</td>
                      <td className="py-2 pr-3">{p.wip}</td>
                      <td className="py-2 pr-3">{p.tasksBlocked}</td>
                      <td className="py-2 pr-3">{p.prsMerged}</td>
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
    </div>
  );
}
