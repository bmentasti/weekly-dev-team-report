"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReportMetrics } from "@/lib/reports/types";
import { useT } from "@/components/i18n-provider";

type TFn = (key: string) => string;

type Tone = "good" | "warn" | "bad";

interface Indicator {
  label: string;
  pct: number;
  tone: Tone;
  message: string;
}

const TONE_BAR: Record<Tone, string> = {
  good: "bg-success",
  warn: "bg-warning",
  bad: "bg-destructive",
};
const TONE_TEXT: Record<Tone, string> = {
  good: "text-success",
  warn: "text-warning",
  bad: "text-destructive",
};

function pctOf(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

function buildIndicators(m: ReportMetrics, t: TFn): Indicator[] {
  const wi = m.workItems;
  const cc = m.codeChanges;
  const out: Indicator[] = [];

  // Avance del sprint (más alto es mejor).
  const avance = m.projectProgress.completionByPoints;
  out.push({
    label: t("rep2.aa.sprintProgress"),
    pct: avance,
    tone: avance >= 75 ? "good" : avance >= 45 ? "warn" : "bad",
    message:
      avance >= 75
        ? t("rep2.aa.sprintProgress.good")
        : avance >= 45
          ? t("rep2.aa.sprintProgress.warn")
          : t("rep2.aa.sprintProgress.bad"),
  });

  // PRs mergeados sobre el total activo (más alto es mejor).
  const prTotal = cc.merged + cc.open;
  const mergedPct = pctOf(cc.merged, prTotal);
  out.push({
    label: t("rep2.aa.prsMerged"),
    pct: mergedPct,
    tone: mergedPct >= 60 ? "good" : mergedPct >= 30 ? "warn" : "bad",
    message:
      cc.open === 0
        ? t("rep2.aa.prsMerged.none")
        : mergedPct >= 60
          ? t("rep2.aa.prsMerged.good")
          : t("rep2.aa.prsMerged.bad"),
  });

  // PRs sin reviewer (más bajo es mejor).
  const noRev = pctOf(cc.withoutReviewer, cc.open);
  out.push({
    label: t("rep2.aa.prsNoReviewer"),
    pct: noRev,
    tone: noRev === 0 ? "good" : noRev <= 30 ? "warn" : "bad",
    message:
      noRev === 0
        ? t("rep2.aa.prsNoReviewer.none")
        : `${t("rep2.aa.prsNoReviewer.assignPrefix")} ${cc.withoutReviewer} ${t("rep2.aa.prsNoReviewer.assignSuffix")}`,
  });

  // Tareas bloqueadas (más bajo es mejor).
  const blocked = pctOf(wi.blocked, wi.total);
  out.push({
    label: t("rep2.aa.blocked"),
    pct: blocked,
    tone: blocked === 0 ? "good" : blocked <= 15 ? "warn" : "bad",
    message:
      wi.blocked === 0
        ? t("rep2.aa.blocked.none")
        : `${t("rep2.aa.blocked.somePrefix")} ${wi.blocked} ${t("rep2.aa.blocked.someSuffix")}`,
  });

  // Tareas sin movimiento (más bajo es mejor).
  const stale = pctOf(wi.stale, wi.total);
  out.push({
    label: t("rep2.aa.stale"),
    pct: stale,
    tone: stale === 0 ? "good" : stale <= 20 ? "warn" : "bad",
    message:
      wi.stale === 0
        ? t("rep2.aa.stale.none")
        : `${t("rep2.aa.stale.somePrefix")} ${wi.stale} ${t("rep2.aa.stale.someSuffix")}`,
  });

  // Defect rate (más bajo es mejor).
  const defect = m.quality?.defectRatePct ?? 0;
  out.push({
    label: t("rep2.aa.defect"),
    pct: defect,
    tone: defect === 0 ? "good" : defect <= 15 ? "warn" : "bad",
    message:
      (m.quality?.bugsOpen ?? 0) === 0
        ? t("rep2.aa.defect.none")
        : `${t("rep2.aa.defect.somePrefix")} ${m.quality?.bugsOpen} ${t("rep2.aa.defect.someSuffix")}`,
  });

  // Scope creep (más bajo es mejor).
  const creep = m.quality?.scopeCreepPct ?? 0;
  out.push({
    label: t("rep2.aa.scopeCreep"),
    pct: creep,
    tone: creep < 15 ? "good" : creep <= 30 ? "warn" : "bad",
    message:
      creep < 15
        ? t("rep2.aa.scopeCreep.stable")
        : `${m.quality?.scopeCreepItems} ${t("rep2.aa.scopeCreep.someSuffix")}`,
  });

  // Éxito de CI (más alto es mejor), solo si hay corridas.
  if (m.ci && m.ci.total > 0) {
    const success = 100 - m.ci.failureRatePct;
    out.push({
      label: t("rep2.aa.ciSuccess"),
      pct: success,
      tone: success >= 90 ? "good" : success >= 70 ? "warn" : "bad",
      message:
        m.ci.failed === 0
          ? t("rep2.aa.ciSuccess.green")
          : `${m.ci.failed} ${t("rep2.aa.ciSuccess.failedSuffix")}${m.ci.deployFailed ? ` (${m.ci.deployFailed} ${t("rep2.aa.ciSuccess.deployPrefix")})` : ""}${t("rep2.aa.ciSuccess.stabilize")}`,
    });
  }

  return out;
}

export function AutomatedAnalysis({ metrics }: { metrics: ReportMetrics }) {
  const { t } = useT();
  const indicators = buildIndicators(metrics, t);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("rep2.aa.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {indicators.map((ind) => (
          <div key={ind.label}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium">{ind.label}</span>
              <span className={TONE_TEXT[ind.tone]}>{ind.pct}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${TONE_BAR[ind.tone]}`}
                style={{ width: `${Math.min(Math.max(ind.pct, 0), 100)}%` }}
              />
            </div>
            <p className={`mt-1 text-xs ${TONE_TEXT[ind.tone]}`}>{ind.message}</p>
          </div>
        ))}
        <p className="pt-1 text-[11px] text-muted-foreground">
          {t("rep2.aa.note")}
        </p>
      </CardContent>
    </Card>
  );
}
