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

/**
 * Alertas tempranas derivadas de las métricas del reporte. Cada una explica qué
 * significa, qué impacto tiene y qué acción tomar, y a qué roles le importa.
 */
export function computeAlerts(m: ReportMetrics): Alert[] {
  const wi = m.workItems;
  const cc = m.codeChanges;
  const alerts: Alert[] = [];

  if (wi.inProgress >= 3 && wi.inProgress > wi.done) {
    alerts.push({
      id: "wip-vs-done",
      title: "Mucho en progreso, poco terminado",
      level: wi.done === 0 ? "high" : "medium",
      meaning: `${wi.inProgress} tareas en progreso vs ${wi.done} finalizadas.`,
      impact: "Trabajo empezado que no cierra: riesgo de carry-over y falta de foco.",
      action: "Limitar WIP, terminar antes de empezar y revisar tareas grandes sin dividir.",
      roles: ["TL", "PO", "DIR"],
    });
  }

  if (cc.old > 0) {
    alerts.push({
      id: "old-prs",
      title: `${cc.old} PR/MR abierto(s) hace +72h`,
      level: cc.old >= 3 ? "high" : "medium",
      meaning: "Cambios listos que no se integran a tiempo.",
      impact: "El código terminado no llega a producción y se acumula riesgo de conflictos.",
      action: "Priorizar reviews y merges; acordar SLA de review (ej. 24h).",
      roles: ["TL", "DIR"],
    });
  }

  if (cc.withoutReviewer > 0) {
    alerts.push({
      id: "no-reviewer",
      title: `${cc.withoutReviewer} PR/MR sin reviewer`,
      level: "medium",
      meaning: "Hay cambios abiertos sin nadie asignado para revisar.",
      impact: "Se frena el flujo de merge y baja la calidad del control cruzado.",
      action: "Asignar reviewers ahora y balancear la carga de review.",
      roles: ["TL"],
    });
  }

  if (cc.checksFailing > 0) {
    alerts.push({
      id: "checks-failing",
      title: `${cc.checksFailing} PR/MR con checks fallando`,
      level: cc.checksFailing >= 2 ? "high" : "medium",
      meaning: "Tests o CI en rojo en cambios abiertos.",
      impact: "Riesgo de mergear código roto o de bloquear el pipeline.",
      action: "Arreglar los checks antes de seguir; no mergear en rojo.",
      roles: ["TL"],
    });
  }

  if (wi.blocked > 0) {
    alerts.push({
      id: "blocked",
      title: `${wi.blocked} tarea(s) bloqueada(s)`,
      level: wi.blocked >= 3 ? "high" : "medium",
      meaning: "Tareas frenadas por dependencias o impedimentos.",
      impact: "Riesgo directo de no cumplir el objetivo del sprint.",
      action: "Asignar responsable a cada bloqueo y destrabar en la próxima daily.",
      roles: ["TL", "PO", "DIR"],
    });
  }

  if (wi.stale > 0) {
    alerts.push({
      id: "stale",
      title: `${wi.stale} tarea(s) sin movimiento (+5 días)`,
      level: wi.stale >= 3 ? "high" : "medium",
      meaning: "Tareas sin actualización reciente.",
      impact: "Puede haber trabajo trabado o que ya no es prioritario.",
      action: "Confirmar vigencia; cerrar, repriorizar o desbloquear.",
      roles: ["TL", "PO"],
    });
  }

  if (wi.critical > 0) {
    alerts.push({
      id: "critical",
      title: `${wi.critical} tarea(s) crítica(s) abierta(s)`,
      level: "medium",
      meaning: "Trabajo de alta prioridad todavía sin cerrar.",
      impact: "Si no se resuelven, comprometen el valor del entregable.",
      action: "Enfocar al equipo en las críticas antes que en lo secundario.",
      roles: ["PO", "DIR"],
    });
  }

  if (m.projectProgress.completionByPoints < 45) {
    alerts.push({
      id: "low-completion",
      title: `Avance bajo (${m.projectProgress.completionByPoints}%)`,
      level: "high",
      meaning: "Se completó menos de la mitad de lo comprometido en puntos.",
      impact: "Alto riesgo de no llegar al entregable del sprint.",
      action: "Revisar alcance: sacar lo no esencial y confirmar compromisos realistas.",
      roles: ["PO", "DIR"],
    });
  }

  if (wi.total > 0 && m.planning.carryOverItems > wi.done) {
    alerts.push({
      id: "carryover",
      title: `Carry-over alto (${m.planning.carryOverItems} sin terminar)`,
      level: "medium",
      meaning: "Se arrastra más de lo que se cerró.",
      impact: "Baja la previsibilidad y el próximo sprint arranca cargado.",
      action: "Cerrar antes de tomar nuevo; ajustar la capacidad comprometida.",
      roles: ["PO", "DIR"],
    });
  }

  const velocities = m.trend.map((t) => t.velocityPoints);
  if (velocities.length >= 2) {
    const current = velocities[velocities.length - 1];
    const prev = velocities[velocities.length - 2];
    if (prev > 0 && current < prev * 0.7) {
      alerts.push({
        id: "velocity-drop",
        title: "Caída de velocity",
        level: "high",
        meaning: `Velocity bajó de ${prev} a ${current} pts respecto al período anterior.`,
        impact: "Menor previsibilidad; puede indicar bloqueos o sobrecarga.",
        action: "Investigar la causa (bloqueos, ausencias, complejidad) antes de recomprometerse.",
        roles: ["DIR", "PO"],
      });
    }
  }

  if (m.quality && m.quality.bugsOpen > 0) {
    alerts.push({
      id: "bugs-open",
      title: `${m.quality.bugsOpen} bug(s) sin resolver`,
      level: m.quality.bugsOpen >= 3 ? "high" : "medium",
      meaning: `Defect rate del ${m.quality.defectRatePct}% sobre el total de tareas.`,
      impact: "Bugs acumulados afectan la calidad del entregable y suman rework.",
      action: "Priorizar la resolución de bugs; no cerrar el sprint con defectos críticos abiertos.",
      roles: ["TL", "PO"],
    });
  }

  if (m.quality && m.quality.scopeCreepPct >= 25) {
    alerts.push({
      id: "scope-creep",
      title: `Scope creep alto (${m.quality.scopeCreepPct}%)`,
      level: m.quality.scopeCreepPct >= 40 ? "high" : "medium",
      meaning: `${m.quality.scopeCreepItems} tarea(s) se agregaron después de iniciado el período.`,
      impact: "Cambios de alcance constantes reducen la previsibilidad y ponen en riesgo el objetivo.",
      action: "Congelar el alcance del sprint; canalizar lo nuevo al backlog y repriorizar en el planning.",
      roles: ["PO", "DIR"],
    });
  }

  if (m.ci && m.ci.failed > 0 && (m.ci.deployFailed > 0 || m.ci.failureRatePct >= 30)) {
    alerts.push({
      id: "ci-failures",
      title:
        m.ci.deployFailed > 0
          ? `${m.ci.deployFailed} deploy(s) fallando`
          : `CI con ${m.ci.failureRatePct}% de fallos`,
      level: m.ci.deployFailed > 0 || m.ci.failureRatePct >= 50 ? "high" : "medium",
      meaning: `${m.ci.failed} de ${m.ci.total} corridas de CI fallaron.`,
      impact: "Pipeline inestable: frena entregas y baja la confianza en el deploy.",
      action: "Estabilizar el pipeline; arreglar los builds/deploys en rojo antes de seguir.",
      roles: ["TL", "DIR"],
    });
  }

  const overloaded = m.people.filter((p) => p.category === "OVERLOADED");
  if (overloaded.length > 0) {
    alerts.push({
      id: "overload",
      title: `Posible sobrecarga: ${overloaded.map((p) => p.name).join(", ")}`,
      level: "medium",
      meaning: "Una o más personas concentran mucho trabajo en progreso.",
      impact: "Cuello de botella y riesgo de burnout; baja el bus factor.",
      action: "Redistribuir carga y revisar dependencias hacia esas personas.",
      roles: ["TL", "DIR"],
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
