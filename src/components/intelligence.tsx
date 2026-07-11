// Componentes de presentación del Intelligence Engine (Etapa 1).
// Server-compatible (sin estado): renderizan el resultado de computeCoverage.
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { BadgeProps } from "@/components/ui/badge";
import {
  COVERAGE_LEVEL_LABELS,
  CONFIDENCE_BAND_LABELS,
  type CoverageLevel,
  type ConfidenceBand,
  type CoverageReport,
  type DimensionCoverage,
} from "@/lib/intelligence/types";
import type { HealthReport, HealthDimension } from "@/lib/intelligence/health";
import type { Recommendation, RecoPriority } from "@/lib/intelligence/recommendations";
import type { DataConflict, ConflictSeverity } from "@/lib/intelligence/conflicts";

type Variant = NonNullable<BadgeProps["variant"]>;

const LEVEL_VARIANT: Record<CoverageLevel, Variant> = {
  INSUFICIENTE: "outline",
  INICIAL: "warning",
  BASICO: "info",
  AVANZADO: "success",
  INTEGRAL: "default",
};

const CONF_VARIANT: Record<ConfidenceBand, Variant> = {
  INSUFICIENTE: "outline",
  BAJO: "destructive",
  MEDIO: "warning",
  ALTO: "info",
  MUY_ALTO: "success",
};

const BAR_COLOR: Record<CoverageLevel, string> = {
  INSUFICIENTE: "bg-slate-300",
  INICIAL: "bg-amber-500",
  BASICO: "bg-blue-500",
  AVANZADO: "bg-emerald-500",
  INTEGRAL: "bg-primary",
};

export function ConfidenceScoreBadge({ band }: { band: ConfidenceBand }) {
  return (
    <Badge variant={CONF_VARIANT[band]}>
      Confianza: {CONFIDENCE_BAND_LABELS[band]}
    </Badge>
  );
}

export function CoverageProgress({
  value,
  level,
}: {
  value: number;
  level: CoverageLevel;
}) {
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Cobertura ${value}% (${COVERAGE_LEVEL_LABELS[level]})`}
    >
      <div
        className={`h-full rounded-full ${BAR_COLOR[level]}`}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

export function DataSourceBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      {label}
    </span>
  );
}

function DimensionCard({ dim }: { dim: DimensionCoverage }) {
  const covered = dim.coverage > 0;
  return (
    <Card>
      <CardContent className="flex h-full flex-col gap-3 py-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold">{dim.label}</p>
            <p className="text-xs text-muted-foreground">
              {dim.coverage}% · {COVERAGE_LEVEL_LABELS[dim.level]}
            </p>
          </div>
          <Badge variant={LEVEL_VARIANT[dim.level]}>
            {COVERAGE_LEVEL_LABELS[dim.level]}
          </Badge>
        </div>

        <CoverageProgress value={dim.coverage} level={dim.level} />

        {covered ? (
          <div className="mt-auto space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {dim.sources.map((s) => (
                <DataSourceBadge key={s} label={s} />
              ))}
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <ConfidenceScoreBadge band={dim.confidence} />
              {dim.freshnessDays !== null && (
                <span>sync hace {dim.freshnessDays}d</span>
              )}
            </div>
            {dim.missing.length > 0 && (
              <p className="text-xs text-amber-700">{dim.missing.join(" · ")}</p>
            )}
          </div>
        ) : (
          <div className="mt-auto space-y-1">
            <p className="text-xs text-muted-foreground">{dim.impact}</p>
            <p className="text-xs">
              <span className="font-medium text-foreground">Recomendado:</span>{" "}
              {dim.recommended.join(", ")}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function CoverageOverview({ report }: { report: CoverageReport }) {
  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 flex-col items-center justify-center rounded-xl bg-primary/10">
              <span className="text-2xl font-bold text-primary">
                {report.overall}
              </span>
              <span className="text-[10px] uppercase text-muted-foreground">
                /100
              </span>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Cobertura de datos global</p>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant={LEVEL_VARIANT[report.level]}>
                  {COVERAGE_LEVEL_LABELS[report.level]}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {report.categoriesCovered}/{report.totalDimensions} dimensiones · {report.connectedCount} integraciones
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {report.dimensions.map((d) => (
          <DimensionCard key={d.key} dim={d} />
        ))}
      </div>
    </div>
  );
}

// --- Health Score ----------------------------------------------------------

const HEALTH_STATUS_VARIANT: Record<HealthDimension["status"], Variant> = {
  ok: "success",
  warn: "warning",
  risk: "destructive",
  insufficient: "outline",
};

const HEALTH_BAR: Record<HealthDimension["status"], string> = {
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  risk: "bg-red-500",
  insufficient: "bg-slate-300",
};

export function HealthScoreCard({ health }: { health: HealthReport }) {
  return (
    <Card>
      <CardContent className="py-5">
        <div className="mb-4 flex items-center gap-4">
          <div className="flex h-16 w-16 flex-col items-center justify-center rounded-xl bg-primary/10">
            <span className="text-2xl font-bold text-primary">
              {health.overall ?? "—"}
            </span>
            <span className="text-[10px] uppercase text-muted-foreground">/100</span>
          </div>
          <div>
            <p className="font-semibold">Health Score</p>
            <p className="text-xs text-muted-foreground">
              Multidimensional · perfil {health.profile} · v1 basado en cobertura de datos
            </p>
          </div>
        </div>
        <div className="space-y-2.5">
          {health.dimensions.map((d) => (
            <div key={d.key} className="grid grid-cols-[110px_1fr_auto] items-center gap-3">
              <span className="text-sm">{d.label}</span>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${HEALTH_BAR[d.status]}`}
                  style={{ width: `${d.score ?? 0}%` }}
                />
              </div>
              {d.score === null ? (
                <Badge variant="outline">Insuficiente</Badge>
              ) : (
                <span className="w-16 text-right text-sm font-medium tabular-nums">
                  {d.score}
                  <span className="ml-1 text-xs text-muted-foreground">·{d.weight}x</span>
                </span>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// --- Recomendaciones -------------------------------------------------------

const PRIORITY_VARIANT: Record<RecoPriority, Variant> = {
  high: "destructive",
  medium: "warning",
  low: "secondary",
};

export function RecommendationCard({ rec }: { rec: Recommendation }) {
  return (
    <Card>
      <CardContent className="space-y-2 py-4">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold">{rec.title}</p>
          <Badge variant={PRIORITY_VARIANT[rec.priority]}>{rec.priority}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{rec.problem}</p>
        <p className="text-sm">
          <span className="font-medium">Acción:</span> {rec.action}
        </p>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span>Esfuerzo: {rec.effort}</span>
          <span>Beneficio: {rec.benefit}</span>
          <span>Confianza: {rec.confidence}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Conflictos ------------------------------------------------------------

const SEVERITY_VARIANT: Record<ConflictSeverity, Variant> = {
  critical: "destructive",
  high: "destructive",
  medium: "warning",
  low: "secondary",
};

export function DataConflictCard({ conflict }: { conflict: DataConflict }) {
  return (
    <Card>
      <CardContent className="space-y-2 py-4">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold">
            {conflict.type} · {conflict.entities.join(", ")}
          </p>
          <Badge variant={SEVERITY_VARIANT[conflict.severity]}>{conflict.severity}</Badge>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {conflict.conflictingValues.map((v, i) => (
            <span key={i} className="rounded-md bg-muted px-2 py-0.5 text-xs">
              {v.source}: <b>{v.value}</b>
            </span>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">{conflict.recommendedAction}</p>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {conflict.prioritySource && <span>Fuente prioritaria: {conflict.prioritySource}</span>}
          <span>Confianza: {conflict.confidence}</span>
          <span>Estado: {conflict.status}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <Card>
      <CardContent className="py-10 text-center">
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
