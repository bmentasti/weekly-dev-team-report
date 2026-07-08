"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReportMetrics } from "@/lib/reports/types";

type Tone = "good" | "warn" | "bad";

interface Indicator {
  label: string;
  pct: number;
  tone: Tone;
  message: string;
}

const TONE_BAR: Record<Tone, string> = {
  good: "bg-emerald-500",
  warn: "bg-amber-500",
  bad: "bg-destructive",
};
const TONE_TEXT: Record<Tone, string> = {
  good: "text-emerald-700",
  warn: "text-amber-700",
  bad: "text-destructive",
};

function pctOf(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

function buildIndicators(m: ReportMetrics): Indicator[] {
  const wi = m.workItems;
  const cc = m.codeChanges;
  const out: Indicator[] = [];

  // Avance del sprint (más alto es mejor).
  const avance = m.projectProgress.completionByPoints;
  out.push({
    label: "Avance del sprint",
    pct: avance,
    tone: avance >= 75 ? "good" : avance >= 45 ? "warn" : "bad",
    message:
      avance >= 75
        ? "Muy buen avance. Mantené el ritmo y cerrá lo que queda."
        : avance >= 45
          ? "Avance razonable. Vigilá los pendientes para no acumular carry-over."
          : "Avance bajo. Priorizá tareas clave y revisá si el alcance es realista.",
  });

  // PRs mergeados sobre el total activo (más alto es mejor).
  const prTotal = cc.merged + cc.open;
  const mergedPct = pctOf(cc.merged, prTotal);
  out.push({
    label: "PRs finalizados",
    pct: mergedPct,
    tone: mergedPct >= 60 ? "good" : mergedPct >= 30 ? "warn" : "bad",
    message:
      cc.open === 0
        ? "No hay PRs abiertos. Flujo de código al día."
        : mergedPct >= 60
          ? "Buen ritmo de merges. El código no se acumula."
          : "Se están acumulando PRs abiertos. Empujá reviews y merges.",
  });

  // PRs sin reviewer (más bajo es mejor).
  const noRev = pctOf(cc.withoutReviewer, cc.open);
  out.push({
    label: "PRs sin reviewer",
    pct: noRev,
    tone: noRev === 0 ? "good" : noRev <= 30 ? "warn" : "bad",
    message:
      noRev === 0
        ? "Todos los PRs abiertos tienen reviewer."
        : `Asigná reviewers: ${cc.withoutReviewer} PR(s) abiertos sin quién revise.`,
  });

  // Tareas bloqueadas (más bajo es mejor).
  const blocked = pctOf(wi.blocked, wi.total);
  out.push({
    label: "Tareas bloqueadas",
    pct: blocked,
    tone: blocked === 0 ? "good" : blocked <= 15 ? "warn" : "bad",
    message:
      wi.blocked === 0
        ? "Sin bloqueos. "
        : `Destrabá en la próxima daily: ${wi.blocked} tarea(s) bloqueada(s).`,
  });

  // Tareas sin movimiento (más bajo es mejor).
  const stale = pctOf(wi.stale, wi.total);
  out.push({
    label: "Tareas sin movimiento",
    pct: stale,
    tone: stale === 0 ? "good" : stale <= 20 ? "warn" : "bad",
    message:
      wi.stale === 0
        ? "Todo tuvo movimiento reciente."
        : `Revisá ${wi.stale} tarea(s) sin update hace +5 días (¿siguen vigentes?).`,
  });

  // Defect rate (más bajo es mejor).
  const defect = m.quality?.defectRatePct ?? 0;
  out.push({
    label: "Defect rate (bugs)",
    pct: defect,
    tone: defect === 0 ? "good" : defect <= 15 ? "warn" : "bad",
    message:
      (m.quality?.bugsOpen ?? 0) === 0
        ? "Sin bugs abiertos en el período."
        : `Resolvé los ${m.quality?.bugsOpen} bug(s) abiertos antes de cerrar el sprint.`,
  });

  // Scope creep (más bajo es mejor).
  const creep = m.quality?.scopeCreepPct ?? 0;
  out.push({
    label: "Scope creep",
    pct: creep,
    tone: creep < 15 ? "good" : creep <= 30 ? "warn" : "bad",
    message:
      creep < 15
        ? "El alcance se mantuvo estable."
        : `${m.quality?.scopeCreepItems} tarea(s) entraron a mitad del período: congelá el alcance.`,
  });

  // Éxito de CI (más alto es mejor), solo si hay corridas.
  if (m.ci && m.ci.total > 0) {
    const success = 100 - m.ci.failureRatePct;
    out.push({
      label: "Éxito de CI",
      pct: success,
      tone: success >= 90 ? "good" : success >= 70 ? "warn" : "bad",
      message:
        m.ci.failed === 0
          ? "Pipeline en verde en el período."
          : `${m.ci.failed} corrida(s) de CI fallaron${m.ci.deployFailed ? ` (${m.ci.deployFailed} de deploy)` : ""}: estabilizá el pipeline.`,
    });
  }

  return out;
}

export function AutomatedAnalysis({ metrics }: { metrics: ReportMetrics }) {
  const indicators = buildIndicators(metrics);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Análisis automático</CardTitle>
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
          Lectura automática por umbrales sobre los datos del período. En el plan
          Pro podés sumar un análisis con IA y hacerle preguntas al reporte.
        </p>
      </CardContent>
    </Card>
  );
}
