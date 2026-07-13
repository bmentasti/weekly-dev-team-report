"use client";

import { useEffect, useMemo, useState } from "react";
import { Info, ListChecks } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  METRIC_DEFS,
  mergeStandard,
  scoreWithStandard,
  type HealthStandardConfig,
} from "@/lib/reports/standards";
import { levelVariant } from "@/lib/reports/score";
import type { ReportMetrics } from "@/lib/reports/types";
import { useT } from "@/components/i18n-provider";

/**
 * Explicabilidad del score (¿por qué este estado?): desglose por dimensión,
 * top razones en contra, métricas sin datos y nivel de confianza. Usa el
 * estándar vigente del proyecto.
 */
export function ScoreBreakdown({
  metrics,
  projectId,
}: {
  metrics: ReportMetrics | null;
  projectId?: string | null;
}) {
  const { t } = useT();
  const [standard, setStandard] = useState<HealthStandardConfig | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // Usa el estándar del proyecto propio del reporte (no el activo).
        const qs = projectId
          ? `?projectId=${encodeURIComponent(projectId)}`
          : "?scope=project";
        const res = await fetch(`/api/report-standards${qs}`);
        const data = await res.json();
        setStandard(mergeStandard(data.standard));
      } catch {
        setStandard(mergeStandard(null));
      }
    })();
  }, [projectId]);

  const b = useMemo(
    () => (standard ? scoreWithStandard(metrics, standard) : null),
    [metrics, standard],
  );

  if (!b) return null;
  const sinDatos = b.level === "SIN_DATOS";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ListChecks className="h-5 w-5 text-primary" />
          {t("rep.whyThisState")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          {sinDatos ? (
            <Badge variant="secondary">{t("rep.notEnoughData")}</Badge>
          ) : (
            <Badge
              variant={levelVariant(
                b.level as Exclude<typeof b.level, "SIN_DATOS">,
              )}
            >
              {t(`lib.level.${b.level as Exclude<typeof b.level, "SIN_DATOS">}`)}
            </Badge>
          )}
          <span className="text-sm text-muted-foreground">
            {t("rep.scorePre")} {b.score ?? "—"}/100 · {t("rep.confidence")}{" "}
            {Math.round(b.confidence * 100)}%
          </span>
        </div>

        {/* Dimensiones */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {b.dimensions.map((d) => (
            <div key={d.dim} className="rounded-input border p-2 text-center">
              <div className="text-base font-bold">
                {d.score === null ? "—" : d.score}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {t(`lib.dimension.${d.dim}`)} · {d.weight}%
              </div>
            </div>
          ))}
        </div>

        {/* Top razones */}
        {b.worst.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground">
              {t("rep.weightsAgainstPre")} {b.worst.length})
            </p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {b.worst.map((w) => (
                <span
                  key={w.key}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    w.state === "risk"
                      ? "bg-red-100 text-red-700"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {w.label}: {w.value}
                  {w.unit}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Sin datos */}
        {b.missing.length > 0 && (
          <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div>
              <span className="font-medium">{t("rep.noData")}</span> {t("rep.noDataDontScore")}
              <ul className="mt-1 space-y-0.5">
                {b.missing.map((x) => {
                  const src = METRIC_DEFS.find((d) => d.key === x.key)?.source;
                  return (
                    <li key={x.key}>
                      · {x.label}
                      {src ? ` — ${src}` : ""}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">
          {t("rep.calculatedWithStandard")}
        </p>
      </CardContent>
    </Card>
  );
}
