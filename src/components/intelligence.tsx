// Componentes de presentación del Intelligence Engine (Etapa 1).
// Server-compatible (sin estado): renderizan el resultado de computeCoverage.
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { BadgeProps } from "@/components/ui/badge";
import { useT } from "@/components/i18n-provider";
import {
  type CoverageLevel,
  type ConfidenceBand,
  type CoverageReport,
  type DimensionCoverage,
} from "@/lib/intelligence/types";
import type { HealthReport, HealthDimension } from "@/lib/intelligence/health";
import type { Recommendation, RecoPriority } from "@/lib/intelligence/recommendations";
import type { DataConflict, ConflictSeverity } from "@/lib/intelligence/conflicts";

type Variant = NonNullable<BadgeProps["variant"]>;
type T = (key: string) => string;

/** Interpola variables `{name}` en un texto ya traducido. */
function fill(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

/**
 * Reconstruye título/problema/acción/beneficio de una recomendación a partir de
 * claves i18n (la lib emite el texto en español para exports/tests; acá se
 * re-traduce por render usando la clave de dimensión y los proveedores que trae
 * la propia recomendación). Los nombres de proveedores NO se traducen.
 */
export function recoText(rec: Recommendation, t: T) {
  const dimKey = rec.dimensionKey ?? rec.id.split("-").slice(1).join("-");
  const label = t(`lib.intel.dim.${dimKey}.label`);
  const impact = t(`lib.intel.dim.${dimKey}.impact`);
  const providers = rec.recommendedProviders ?? [];
  const sep = t("lib.intel.reco.optionsSeparator");
  const options = providers.join(sep);
  const isReinforce = rec.id.startsWith("reinforce-");
  if (isReinforce) {
    return {
      title: fill(t("lib.intel.reco.reinforce.title"), { label }),
      problem: fill(t("lib.intel.reco.reinforce.problem"), { label }),
      action: fill(t("lib.intel.reco.reinforce.action"), { options }),
      benefit: fill(t("lib.intel.reco.reinforce.benefit"), { label }),
    };
  }
  return {
    title: fill(t("lib.intel.reco.connect.title"), { source: providers[0] ?? "", label }),
    problem: fill(t("lib.intel.reco.connect.problem"), { labelLower: label.toLowerCase(), impact }),
    action: fill(t("lib.intel.reco.connect.action"), { options }),
    benefit: fill(t("lib.intel.reco.connect.benefit"), { label }),
  };
}

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
  INSUFICIENTE: "bg-muted-foreground/40",
  INICIAL: "bg-warning",
  BASICO: "bg-primary/60",
  AVANZADO: "bg-success",
  INTEGRAL: "bg-primary",
};

export function ConfidenceScoreBadge({ band }: { band: ConfidenceBand }) {
  const { t } = useT();
  return (
    <Badge variant={CONF_VARIANT[band]}>
      {t("rep2.intel.confidence")} {t(`lib.confidenceBand.${band}`)}
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
  const { t } = useT();
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${t("rep2.intel.coverageAria.prefix")} ${value}% (${t(`lib.coverageLevel.${level}`)})`}
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
  const { t } = useT();
  const covered = dim.coverage > 0;
  return (
    <Card>
      <CardContent className="flex h-full flex-col gap-3 py-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold">{t(`lib.intel.dim.${dim.key}.label`)}</p>
            <p className="text-xs text-muted-foreground">
              {dim.coverage}% · {t(`lib.coverageLevel.${dim.level}`)}
            </p>
          </div>
          <Badge variant={LEVEL_VARIANT[dim.level]}>
            {t(`lib.coverageLevel.${dim.level}`)}
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
                <span>{t("rep2.intel.syncAgo.prefix")} {dim.freshnessDays}d</span>
              )}
            </div>
            {dim.missing.length > 0 && (
              <p className="text-xs text-warning">{t("lib.intel.missing.noPrimary")}</p>
            )}
          </div>
        ) : (
          <div className="mt-auto space-y-1">
            <p className="text-xs text-muted-foreground">{t(`lib.intel.dim.${dim.key}.impact`)}</p>
            <p className="text-xs">
              <span className="font-medium text-foreground">{t("rep2.intel.recommended")}</span>{" "}
              {dim.recommended.join(", ")}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function CoverageOverview({ report }: { report: CoverageReport }) {
  const { t } = useT();
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
              <p className="text-sm text-muted-foreground">{t("rep2.intel.globalCoverage")}</p>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant={LEVEL_VARIANT[report.level]}>
                  {t(`lib.coverageLevel.${report.level}`)}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {report.categoriesCovered}/{report.totalDimensions} {t("rep2.intel.dimensions")} · {report.connectedCount} {t("rep2.intel.integrations")}
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
  ok: "bg-success",
  warn: "bg-warning",
  risk: "bg-destructive",
  insufficient: "bg-muted-foreground/40",
};

export function HealthScoreCard({ health }: { health: HealthReport }) {
  const { t } = useT();
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
            <p className="font-semibold">{t("rep2.intel.healthScore")}</p>
            <p className="text-xs text-muted-foreground">
              {t("rep2.intel.healthProfilePrefix")} {health.profile} {t("rep2.intel.healthProfileSuffix")}
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
                <Badge variant="outline">{t("rep2.intel.insufficient")}</Badge>
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
  const { t } = useT();
  const txt = recoText(rec, t);
  return (
    <Card>
      <CardContent className="space-y-2 py-4">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold">{txt.title}</p>
          <Badge variant={PRIORITY_VARIANT[rec.priority]}>{rec.priority}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{txt.problem}</p>
        <p className="text-sm">
          <span className="font-medium">{t("rep2.intel.action")}</span> {txt.action}
        </p>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span>{t("rep2.intel.effort")} {rec.effort}</span>
          <span>{t("rep2.intel.benefit")} {txt.benefit}</span>
          <span>{t("rep2.intel.confidenceLabel")} {rec.confidence}</span>
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
  const { t } = useT();
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
        <p className="text-sm text-muted-foreground">
          {t(`lib.intel.conflict.${conflict.type}`)}
        </p>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {conflict.prioritySource && <span>{t("rep2.intel.prioritySource")} {conflict.prioritySource}</span>}
          <span>{t("rep2.intel.confidenceLabel")} {conflict.confidence}</span>
          <span>{t("rep2.intel.status")} {conflict.status}</span>
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
