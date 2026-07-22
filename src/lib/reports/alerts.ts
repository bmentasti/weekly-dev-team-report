import type { ReportMetrics } from "./types";

export type AlertLevel = "high" | "medium" | "low";
export type AlertRole = "TL" | "PO" | "DIR";

export interface Alert {
  id: string;
  title: string;
  level: AlertLevel;
  meaning: string;
  impact: string;
  action: string;
  roles: AlertRole[];
}

export const ROLE_LABELS: Record<AlertRole, string> = {
  TL: "Tech Lead",
  PO: "Product Owner",
  DIR: "Dirección",
};

/** Función de traducción con interpolación de variables `{name}`. */
export type Translate = (key: string) => string;

function fill(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

/**
 * Alertas tempranas derivadas de las métricas del reporte. Cada una explica qué
 * significa, qué impacto tiene y qué acción tomar, y a qué roles le importa.
 *
 * `t` es opcional: si se pasa (desde un componente con i18n), los textos salen
 * traducidos; si no, caen a español (para no romper usos server-side que solo
 * cuentan alertas).
 */
export function computeAlerts(m: ReportMetrics, t?: Translate): Alert[] {
  const tr = (key: string, fallback: string, vars?: Record<string, string | number>) =>
    t ? fill(t(key), vars) : fill(fallback, vars);
  const wi = m.workItems;
  const cc = m.codeChanges;
  const alerts: Alert[] = [];

  if (wi.inProgress >= 3 && wi.inProgress > wi.done) {
    alerts.push({
      id: "wip-vs-done",
      title: tr("lib.alert.wipVsDone.title", "Mucho en progreso, poco terminado"),
      level: wi.done === 0 ? "high" : "medium",
      meaning: tr("lib.alert.wipVsDone.meaning", "{inProgress} tareas en progreso vs {done} finalizadas.", { inProgress: wi.inProgress, done: wi.done }),
      impact: tr("lib.alert.wipVsDone.impact", "Trabajo empezado que no cierra: riesgo de carry-over y falta de foco."),
      action: tr("lib.alert.wipVsDone.action", "Limitar WIP, terminar antes de empezar y revisar tareas grandes sin dividir."),
      roles: ["TL", "PO", "DIR"],
    });
  }

  if (cc.old > 0) {
    alerts.push({
      id: "old-prs",
      title: tr("lib.alert.oldPrs.title", "{count} PR/MR abierto(s) hace +72h", { count: cc.old }),
      level: cc.old >= 3 ? "high" : "medium",
      meaning: tr("lib.alert.oldPrs.meaning", "Cambios listos que no se integran a tiempo."),
      impact: tr("lib.alert.oldPrs.impact", "El código terminado no llega a producción y se acumula riesgo de conflictos."),
      action: tr("lib.alert.oldPrs.action", "Priorizar reviews y merges; acordar SLA de review (ej. 24h)."),
      roles: ["TL", "DIR"],
    });
  }

  if (cc.withoutReviewer > 0) {
    alerts.push({
      id: "no-reviewer",
      title: tr("lib.alert.noReviewer.title", "{count} PR/MR sin reviewer", { count: cc.withoutReviewer }),
      level: "medium",
      meaning: tr("lib.alert.noReviewer.meaning", "Hay cambios abiertos sin nadie asignado para revisar."),
      impact: tr("lib.alert.noReviewer.impact", "Se frena el flujo de merge y baja la calidad del control cruzado."),
      action: tr("lib.alert.noReviewer.action", "Asignar reviewers ahora y balancear la carga de review."),
      roles: ["TL"],
    });
  }

  if (cc.checksFailing > 0) {
    alerts.push({
      id: "checks-failing",
      title: tr("lib.alert.checksFailing.title", "{count} PR/MR con checks fallando", { count: cc.checksFailing }),
      level: cc.checksFailing >= 2 ? "high" : "medium",
      meaning: tr("lib.alert.checksFailing.meaning", "Tests o CI en rojo en cambios abiertos."),
      impact: tr("lib.alert.checksFailing.impact", "Riesgo de mergear código roto o de bloquear el pipeline."),
      action: tr("lib.alert.checksFailing.action", "Arreglar los checks antes de seguir; no mergear en rojo."),
      roles: ["TL"],
    });
  }

  if (wi.blocked > 0) {
    alerts.push({
      id: "blocked",
      title: tr("lib.alert.blocked.title", "{count} tarea(s) bloqueada(s)", { count: wi.blocked }),
      level: wi.blocked >= 3 ? "high" : "medium",
      meaning: tr("lib.alert.blocked.meaning", "Tareas frenadas por dependencias o impedimentos."),
      impact: tr("lib.alert.blocked.impact", "Riesgo directo de no cumplir el objetivo del sprint."),
      action: tr("lib.alert.blocked.action", "Asignar responsable a cada bloqueo y destrabar en la próxima daily."),
      roles: ["TL", "PO", "DIR"],
    });
  }

  if (wi.stale > 0) {
    alerts.push({
      id: "stale",
      title: tr("lib.alert.stale.title", "{count} tarea(s) sin movimiento (+5 días)", { count: wi.stale }),
      level: wi.stale >= 3 ? "high" : "medium",
      meaning: tr("lib.alert.stale.meaning", "Tareas sin actualización reciente."),
      impact: tr("lib.alert.stale.impact", "Puede haber trabajo trabado o que ya no es prioritario."),
      action: tr("lib.alert.stale.action", "Confirmar vigencia; cerrar, repriorizar o desbloquear."),
      roles: ["TL", "PO"],
    });
  }

  if (wi.critical > 0) {
    alerts.push({
      id: "critical",
      title: tr("lib.alert.critical.title", "{count} tarea(s) crítica(s) abierta(s)", { count: wi.critical }),
      level: "medium",
      meaning: tr("lib.alert.critical.meaning", "Trabajo de alta prioridad todavía sin cerrar."),
      impact: tr("lib.alert.critical.impact", "Si no se resuelven, comprometen el valor del entregable."),
      action: tr("lib.alert.critical.action", "Enfocar al equipo en las críticas antes que en lo secundario."),
      roles: ["PO", "DIR"],
    });
  }

  if (m.projectProgress.completionByPoints < 45) {
    alerts.push({
      id: "low-completion",
      title: tr("lib.alert.lowCompletion.title", "Avance bajo ({pct}%)", { pct: m.projectProgress.completionByPoints }),
      level: "high",
      meaning: tr("lib.alert.lowCompletion.meaning", "Se completó menos de la mitad de lo comprometido en puntos."),
      impact: tr("lib.alert.lowCompletion.impact", "Alto riesgo de no llegar al entregable del sprint."),
      action: tr("lib.alert.lowCompletion.action", "Revisar alcance: sacar lo no esencial y confirmar compromisos realistas."),
      roles: ["PO", "DIR"],
    });
  }

  if (wi.total > 0 && m.planning.carryOverItems > wi.done) {
    alerts.push({
      id: "carryover",
      title: tr("lib.alert.carryover.title", "Carry-over alto ({count} sin terminar)", { count: m.planning.carryOverItems }),
      level: "medium",
      meaning: tr("lib.alert.carryover.meaning", "Se arrastra más de lo que se cerró."),
      impact: tr("lib.alert.carryover.impact", "Baja la previsibilidad y el próximo sprint arranca cargado."),
      action: tr("lib.alert.carryover.action", "Cerrar antes de tomar nuevo; ajustar la capacidad comprometida."),
      roles: ["PO", "DIR"],
    });
  }

  const velocities = m.trend.map((tp) => tp.velocityPoints);
  if (velocities.length >= 2) {
    const current = velocities[velocities.length - 1];
    const prev = velocities[velocities.length - 2];
    if (prev > 0 && current < prev * 0.7) {
      alerts.push({
        id: "velocity-drop",
        title: tr("lib.alert.velocityDrop.title", "Caída de velocity"),
        level: "high",
        meaning: tr("lib.alert.velocityDrop.meaning", "Velocity bajó de {prev} a {current} pts respecto al período anterior.", { prev, current }),
        impact: tr("lib.alert.velocityDrop.impact", "Menor previsibilidad; puede indicar bloqueos o sobrecarga."),
        action: tr("lib.alert.velocityDrop.action", "Investigar la causa (bloqueos, ausencias, complejidad) antes de recomprometerse."),
        roles: ["DIR", "PO"],
      });
    }
  }

  if (m.quality && m.quality.bugsOpen > 0) {
    alerts.push({
      id: "bugs-open",
      title: tr("lib.alert.bugsOpen.title", "{count} bug(s) sin resolver", { count: m.quality.bugsOpen }),
      level: m.quality.bugsOpen >= 3 ? "high" : "medium",
      meaning: tr("lib.alert.bugsOpen.meaning", "Defect rate del {rate}% sobre el total de tareas.", { rate: m.quality.defectRatePct }),
      impact: tr("lib.alert.bugsOpen.impact", "Bugs acumulados afectan la calidad del entregable y suman rework."),
      action: tr("lib.alert.bugsOpen.action", "Priorizar la resolución de bugs; no cerrar el sprint con defectos críticos abiertos."),
      roles: ["TL", "PO"],
    });
  }

  if (m.quality && m.quality.scopeCreepPct >= 25) {
    alerts.push({
      id: "scope-creep",
      title: tr("lib.alert.scopeCreep.title", "Scope creep alto ({pct}%)", { pct: m.quality.scopeCreepPct }),
      level: m.quality.scopeCreepPct >= 40 ? "high" : "medium",
      meaning: tr("lib.alert.scopeCreep.meaning", "{count} tarea(s) se agregaron después de iniciado el período.", { count: m.quality.scopeCreepItems }),
      impact: tr("lib.alert.scopeCreep.impact", "Cambios de alcance constantes reducen la previsibilidad y ponen en riesgo el objetivo."),
      action: tr("lib.alert.scopeCreep.action", "Congelar el alcance del sprint; canalizar lo nuevo al backlog y repriorizar en el planning."),
      roles: ["PO", "DIR"],
    });
  }

  if (m.ci && m.ci.failed > 0 && (m.ci.deployFailed > 0 || m.ci.failureRatePct >= 30)) {
    alerts.push({
      id: "ci-failures",
      title:
        m.ci.deployFailed > 0
          ? tr("lib.alert.ciFailures.titleDeploy", "{count} deploy(s) fallando", { count: m.ci.deployFailed })
          : tr("lib.alert.ciFailures.titleRate", "CI con {rate}% de fallos", { rate: m.ci.failureRatePct }),
      level: m.ci.deployFailed > 0 || m.ci.failureRatePct >= 50 ? "high" : "medium",
      meaning: tr("lib.alert.ciFailures.meaning", "{failed} de {total} corridas de CI fallaron.", { failed: m.ci.failed, total: m.ci.total }),
      impact: tr("lib.alert.ciFailures.impact", "Pipeline inestable: frena entregas y baja la confianza en el deploy."),
      action: tr("lib.alert.ciFailures.action", "Estabilizar el pipeline; arreglar los builds/deploys en rojo antes de seguir."),
      roles: ["TL", "DIR"],
    });
  }

  const overloaded = m.people.filter((p) => p.category === "OVERLOADED");
  if (overloaded.length > 0) {
    alerts.push({
      id: "overload",
      title: tr("lib.alert.overload.title", "Posible sobrecarga: {names}", { names: overloaded.map((p) => p.name).join(", ") }),
      level: "medium",
      meaning: tr("lib.alert.overload.meaning", "Una o más personas concentran mucho trabajo en progreso."),
      impact: tr("lib.alert.overload.impact", "Cuello de botella y riesgo de burnout; baja el bus factor."),
      action: tr("lib.alert.overload.action", "Redistribuir carga y revisar dependencias hacia esas personas."),
      roles: ["TL", "DIR"],
    });
  }

  return alerts;
}

/** Insumos financieros compactos para las alertas del reporte (§ presupuesto). */
export interface FinanceAlertInput {
  currency: string;
  eac: number | null;
  currentBudget: number | null;
  projectedProfit: number | null;
  projectedMarginPct: number | null;
  targetMarginPct: number | null;
  budgetRunwayDays: number | null;
  daysToForecastEnd: number | null;
  hasMargins: boolean;
}

function fmtMoney(v: number | null | undefined, currency: string): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return "s/d";
  return `${currency} ${Math.round(v).toLocaleString("en-US")}`;
}

/**
 * Alertas FINANCIERAS para el reporte: principalmente "presupuesto excedido"
 * (EAC > presupuesto vigente), más pérdida/margen bajo y runway corto. Se
 * fusionan con las alertas operativas del reporte. Respeta el enmascarado de
 * márgenes (hasMargins): sin ese permiso, sólo se muestran alertas de costo.
 */
export function computeFinanceAlerts(fin: FinanceAlertInput | null | undefined, t?: Translate): Alert[] {
  if (!fin) return [];
  const tr = (key: string, fallback: string, vars?: Record<string, string | number>) =>
    t ? fill(t(key), vars) : fill(fallback, vars);
  const c = fin.currency;
  const alerts: Alert[] = [];

  // Presupuesto excedido (proyección): EAC supera el presupuesto vigente.
  if (
    typeof fin.eac === "number" &&
    typeof fin.currentBudget === "number" &&
    fin.eac > fin.currentBudget
  ) {
    const over = fin.eac - fin.currentBudget;
    alerts.push({
      id: "finance-over-budget",
      title: tr("lib.alert.finOverBudget.title", "Presupuesto excedido (proyección)"),
      level: "high",
      meaning: tr(
        "lib.alert.finOverBudget.meaning",
        "El costo estimado al finalizar ({eac}) supera el presupuesto vigente ({budget}) en {over}.",
        { eac: fmtMoney(fin.eac, c), budget: fmtMoney(fin.currentBudget, c), over: fmtMoney(over, c) },
      ),
      impact: tr(
        "lib.alert.finOverBudget.impact",
        "Sin acción, el proyecto cierra por encima del presupuesto aprobado y erosiona el margen.",
      ),
      action: tr(
        "lib.alert.finOverBudget.action",
        "Evaluar ampliación presupuestaria, reducir alcance/costo restante o renegociar precio.",
      ),
      roles: ["TL", "PO", "DIR"],
    });
  }

  // Ganancia proyectada negativa (sólo con permiso de márgenes).
  if (fin.hasMargins && typeof fin.projectedProfit === "number" && fin.projectedProfit < 0) {
    alerts.push({
      id: "finance-projected-loss",
      title: tr("lib.alert.finLoss.title", "Pérdida proyectada"),
      level: "high",
      meaning: tr("lib.alert.finLoss.meaning", "La ganancia proyectada es negativa ({loss}).", {
        loss: fmtMoney(fin.projectedProfit, c),
      }),
      impact: tr("lib.alert.finLoss.impact", "El proyecto termina perdiendo dinero al ritmo actual."),
      action: tr("lib.alert.finLoss.action", "Escalar: renegociar, recortar costo o revisar viabilidad."),
      roles: ["PO", "DIR"],
    });
  }

  // Margen por debajo del objetivo.
  if (
    fin.hasMargins &&
    typeof fin.projectedMarginPct === "number" &&
    typeof fin.targetMarginPct === "number" &&
    fin.projectedMarginPct >= 0 &&
    fin.projectedMarginPct < fin.targetMarginPct
  ) {
    alerts.push({
      id: "finance-margin-below-target",
      title: tr("lib.alert.finMargin.title", "Margen por debajo del objetivo"),
      level: "medium",
      meaning: tr(
        "lib.alert.finMargin.meaning",
        "El margen proyectado ({m}%) está por debajo del objetivo ({target}%).",
        { m: Math.round(fin.projectedMarginPct * 10) / 10, target: Math.round(fin.targetMarginPct * 10) / 10 },
      ),
      impact: tr("lib.alert.finMargin.impact", "La rentabilidad esperada no se está cumpliendo."),
      action: tr("lib.alert.finMargin.action", "Optimizar costo restante o revisar precio/alcance."),
      roles: ["PO", "DIR"],
    });
  }

  // Presupuesto se agota antes del cierre forecast.
  if (
    typeof fin.budgetRunwayDays === "number" &&
    typeof fin.daysToForecastEnd === "number" &&
    fin.budgetRunwayDays < fin.daysToForecastEnd
  ) {
    alerts.push({
      id: "finance-runway-short",
      title: tr("lib.alert.finRunway.title", "El presupuesto se agota antes del cierre"),
      level: "medium",
      meaning: tr(
        "lib.alert.finRunway.meaning",
        "Al ritmo de gasto actual, el presupuesto alcanza ~{days} días, antes de la fecha forecast.",
        { days: Math.round(fin.budgetRunwayDays) },
      ),
      impact: tr("lib.alert.finRunway.impact", "Riesgo de quedarse sin fondos antes de terminar."),
      action: tr("lib.alert.finRunway.action", "Planificar financiamiento o ajustar el ritmo de gasto."),
      roles: ["DIR", "PO"],
    });
  }

  return alerts;
}

export function alertsForRole(alerts: Alert[], role: AlertRole): Alert[] {
  return alerts
    .filter((a) => a.roles.includes(role))
    .sort((a, b) => weight(b.level) - weight(a.level));
}

function weight(l: AlertLevel): number {
  return l === "high" ? 3 : l === "medium" ? 2 : 1;
}
