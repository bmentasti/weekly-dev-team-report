// i18n namespace: texto GENERADO y persistido al crear un reporte (risks,
// recommendations, summary, next steps, planning, markdown). Prefijo "gen.".
// Los tokens {x} se interpolan con makeT(locale)(key, params).
export const es: Record<string, string> = {
  // nextStepFor (por categoría de persona)
  "gen.nextStep.SUPPORT":
    "Conversar 1:1 para destrabar bloqueos y priorizar. Ofrecer ayuda o pairing.",
  "gen.nextStep.OVERLOADED":
    "Redistribuir parte del WIP; hay riesgo de cuello de botella y burnout.",
  "gen.nextStep.RECOGNIZE":
    "Reconocer el aporte. Buen candidato/a para mentoría o tareas de mayor impacto.",
  "gen.nextStep.FREE_CAPACITY":
    "Tiene capacidad disponible; asignar trabajo del backlog o revisiones.",
  "gen.nextStep.ON_TRACK": "En seguimiento. Mantener seguimiento habitual.",
  "gen.nextStep.INSUFFICIENT_DATA":
    "Datos insuficientes para evaluar. Verificá el mapeo del responsable y la completitud de los registros en Airtable antes de concluir.",

  // Risks
  "gen.risk.criticalStale.title": "{count} tarea(s) crítica(s) sin movimiento",
  "gen.risk.blocked.title": "{count} tarea(s) bloqueada(s)",
  "gen.risk.oldPrs.title": "{count} PR/MR abierto(s) hace más de 72h",
  "gen.risk.oldPrs.detail": "Acumulación de trabajo pendiente de merge.",
  "gen.risk.noReviewer.title": "{count} PR/MR sin reviewer / re-review",
  "gen.risk.noReviewer.detail":
    "Hay cambios abiertos sin nadie asignado para revisarlos, o esperando nueva revisión tras cambios solicitados.",
  "gen.risk.checksFailing.title": "{count} PR/MR con checks fallando",
  "gen.risk.checksFailing.detail": "Tests o CI en rojo en cambios abiertos.",
  "gen.risk.overloaded.title": "Posible sobrecarga: {name}",
  "gen.risk.overloaded.detail": "{wip} tareas en progreso asignadas.",
  "gen.risk.blockers.title":
    "{count} posible(s) blocker(s) mencionado(s) en Slack",
  "gen.risk.blockers.detail": "Revisar la conversación reciente del equipo.",

  // Recommendations
  "gen.rec.reviewers":
    "Asignar reviewers y destrabar los PR/MR pendientes de review.",
  "gen.rec.blocked":
    "Revisar tareas bloqueadas y críticas sin movimiento en la próxima daily.",
  "gen.rec.checks": "Arreglar los checks/CI que están fallando.",
  "gen.rec.balance": "Balancear la carga: {names} con WIP alto.",
  "gen.rec.freeCapacity":
    "Hay personas con capacidad libre; asignarles trabajo del backlog.",
  "gen.rec.highRisk": "Confirmar si el alcance del sprint sigue siendo realista.",
  "gen.rec.healthy":
    "El avance es saludable. Mantener el ritmo y seguimiento actual.",

  // Executive summary
  "gen.health.HEALTHY": "saludable",
  "gen.health.MEDIUM_RISK": "con riesgo medio",
  "gen.health.HIGH_RISK": "con riesgo alto",
  "gen.summary.main":
    "El equipo completó {completed} de {committed} story points ({pct}%), cerró {done} tarea(s) y mergeó {merged} PR/MR. Estado general {health}.",
  "gen.summary.concerns": "Puntos de atención: {list}.",
  "gen.concern.criticalStale": "{count} crítica(s) sin movimiento",
  "gen.concern.blocked": "{count} bloqueada(s)",
  "gen.concern.oldPrs": "{count} PR/MR viejo(s)",
  "gen.concern.noReviewer": "{count} sin reviewer / re-review",

  // Planning focus reason
  "gen.focus.blocked": "Bloqueada",
  "gen.focus.criticalStale": "Crítica sin movimiento",

  // Trend current point
  "gen.trend.current": "Actual",

  // ---- Markdown export (mismo idioma que el reporte) ----
  "gen.md.title": "Reporte semanal del equipo",
  "gen.md.period": "Período",
  "gen.md.periodTo": "al",
  "gen.md.overall": "Estado general",
  "gen.md.execSummary": "Resumen ejecutivo",
  "gen.md.capacityVelocity": "Capacidad y velocity",
  "gen.md.storyPoints": "Story points",
  "gen.md.completedSuffix": "completados",
  "gen.md.periodVelocity": "Velocity del período",
  "gen.md.remainingPoints": "Puntos restantes",
  "gen.md.avgCycleTime": "Cycle time promedio",
  "gen.md.days": "días",
  "gen.md.projectProgress": "Avance del proyecto",
  "gen.md.tasks": "tareas",
  "gen.md.mainMetrics": "Métricas principales",
  "gen.md.tasksDone": "Tareas finalizadas",
  "gen.md.tasksInProgress": "Tareas en progreso",
  "gen.md.tasksBlocked": "Tareas bloqueadas",
  "gen.md.tasksStale": "Tareas sin movimiento",
  "gen.md.tasksCritical": "Tareas críticas",
  "gen.md.prsOpen": "PR/MR abiertos",
  "gen.md.prsMerged": "PR/MR mergeados",
  "gen.md.prsNoReviewer": "PR/MR sin reviewer",
  "gen.md.prsOld": "PR/MR abiertos > 72h",
  "gen.md.possibleBlockers": "Posibles blockers (Slack)",
  "gen.md.sectionTasksDone": "Tareas finalizadas",
  "gen.md.sectionTasksAtRisk": "Tareas en riesgo",
  "gen.md.sectionPrsMerged": "Pull/Merge Requests mergeados",
  "gen.md.sectionPrsAtRisk": "Pull/Merge Requests con riesgo",
  "gen.md.risksDetected": "Riesgos detectados",
  "gen.md.recommendations": "Recomendaciones",
  "gen.md.planningInputs": "Insumos para el próximo planning",
  "gen.md.carryOver":
    "Carry-over: {items} tarea(s) sin terminar ({points} pts)",
  "gen.md.forecast":
    "Forecast de capacidad: ~{points} pts para el próximo período",
  "gen.md.recommendedFocus": "Foco recomendado",
  "gen.md.byPerson": "Por persona (señales para conversar)",
  "gen.md.peopleNote":
    "Estas métricas son proxies (no todo el trabajo se ticketea; los story points varían). Usalas como punto de partida para conversar, no como puntaje absoluto.",
  "gen.md.thPerson": "Persona",
  "gen.md.thSignal": "Señal",
  "gen.md.thDone": "Finalizadas",
  "gen.md.thSpCompleted": "SP compl.",
  "gen.md.thInProgress": "En progreso",
  "gen.md.thBlocked": "Bloqueadas",
  "gen.md.thPrMerged": "PR merg.",
  "gen.md.thScore": "Score",
};

export const en: Record<string, string> = {
  // nextStepFor (by person category)
  "gen.nextStep.SUPPORT":
    "Have a 1:1 to unblock and reprioritize. Offer help or pairing.",
  "gen.nextStep.OVERLOADED":
    "Redistribute some WIP; there's a bottleneck and burnout risk.",
  "gen.nextStep.RECOGNIZE":
    "Recognize the contribution. Good candidate for mentoring or higher-impact work.",
  "gen.nextStep.FREE_CAPACITY":
    "Has spare capacity; assign backlog work or reviews.",
  "gen.nextStep.ON_TRACK": "On track. Keep the usual follow-up.",
  "gen.nextStep.INSUFFICIENT_DATA":
    "Not enough data to evaluate. Verify the assignee mapping and record completeness in Airtable before concluding.",

  // Risks
  "gen.risk.criticalStale.title": "{count} critical task(s) with no movement",
  "gen.risk.blocked.title": "{count} blocked task(s)",
  "gen.risk.oldPrs.title": "{count} PR/MR open for more than 72h",
  "gen.risk.oldPrs.detail": "Work piling up waiting to be merged.",
  "gen.risk.noReviewer.title": "{count} PR/MR without reviewer / re-review",
  "gen.risk.noReviewer.detail":
    "There are open changes with no one assigned to review them, or waiting for a new review after requested changes.",
  "gen.risk.checksFailing.title": "{count} PR/MR with failing checks",
  "gen.risk.checksFailing.detail": "Tests or CI red on open changes.",
  "gen.risk.overloaded.title": "Possible overload: {name}",
  "gen.risk.overloaded.detail": "{wip} in-progress tasks assigned.",
  "gen.risk.blockers.title": "{count} possible blocker(s) mentioned in Slack",
  "gen.risk.blockers.detail": "Review the team's recent conversation.",

  // Recommendations
  "gen.rec.reviewers": "Assign reviewers and unblock the PR/MR pending review.",
  "gen.rec.blocked":
    "Review blocked and critical stale tasks in the next daily.",
  "gen.rec.checks": "Fix the failing checks/CI.",
  "gen.rec.balance": "Balance the load: {names} with high WIP.",
  "gen.rec.freeCapacity":
    "Some people have spare capacity; assign them backlog work.",
  "gen.rec.highRisk": "Confirm whether the sprint scope is still realistic.",
  "gen.rec.healthy":
    "Progress is healthy. Keep the current pace and follow-up.",

  // Executive summary
  "gen.health.HEALTHY": "healthy",
  "gen.health.MEDIUM_RISK": "at medium risk",
  "gen.health.HIGH_RISK": "at high risk",
  "gen.summary.main":
    "The team completed {completed} of {committed} story points ({pct}%), closed {done} task(s) and merged {merged} PR/MR. Overall status {health}.",
  "gen.summary.concerns": "Points of attention: {list}.",
  "gen.concern.criticalStale": "{count} critical stale",
  "gen.concern.blocked": "{count} blocked",
  "gen.concern.oldPrs": "{count} old PR/MR",
  "gen.concern.noReviewer": "{count} without reviewer / re-review",

  // Planning focus reason
  "gen.focus.blocked": "Blocked",
  "gen.focus.criticalStale": "Critical, no movement",

  // Trend current point
  "gen.trend.current": "Current",

  // ---- Markdown export (same language as the report) ----
  "gen.md.title": "Weekly team report",
  "gen.md.period": "Period",
  "gen.md.periodTo": "to",
  "gen.md.overall": "Overall status",
  "gen.md.execSummary": "Executive summary",
  "gen.md.capacityVelocity": "Capacity and velocity",
  "gen.md.storyPoints": "Story points",
  "gen.md.completedSuffix": "completed",
  "gen.md.periodVelocity": "Period velocity",
  "gen.md.remainingPoints": "Remaining points",
  "gen.md.avgCycleTime": "Average cycle time",
  "gen.md.days": "days",
  "gen.md.projectProgress": "Project progress",
  "gen.md.tasks": "tasks",
  "gen.md.mainMetrics": "Key metrics",
  "gen.md.tasksDone": "Tasks done",
  "gen.md.tasksInProgress": "Tasks in progress",
  "gen.md.tasksBlocked": "Blocked tasks",
  "gen.md.tasksStale": "Stale tasks",
  "gen.md.tasksCritical": "Critical tasks",
  "gen.md.prsOpen": "Open PR/MR",
  "gen.md.prsMerged": "Merged PR/MR",
  "gen.md.prsNoReviewer": "PR/MR without reviewer",
  "gen.md.prsOld": "PR/MR open > 72h",
  "gen.md.possibleBlockers": "Possible blockers (Slack)",
  "gen.md.sectionTasksDone": "Tasks done",
  "gen.md.sectionTasksAtRisk": "Tasks at risk",
  "gen.md.sectionPrsMerged": "Merged Pull/Merge Requests",
  "gen.md.sectionPrsAtRisk": "Pull/Merge Requests at risk",
  "gen.md.risksDetected": "Risks detected",
  "gen.md.recommendations": "Recommendations",
  "gen.md.planningInputs": "Inputs for the next planning",
  "gen.md.carryOver": "Carry-over: {items} unfinished task(s) ({points} pts)",
  "gen.md.forecast": "Capacity forecast: ~{points} pts for the next period",
  "gen.md.recommendedFocus": "Recommended focus",
  "gen.md.byPerson": "By person (signals to discuss)",
  "gen.md.peopleNote":
    "These metrics are proxies (not all work is ticketed; story points vary). Use them as a starting point for conversation, not as an absolute score.",
  "gen.md.thPerson": "Person",
  "gen.md.thSignal": "Signal",
  "gen.md.thDone": "Done",
  "gen.md.thSpCompleted": "SP compl.",
  "gen.md.thInProgress": "In progress",
  "gen.md.thBlocked": "Blocked",
  "gen.md.thPrMerged": "PR merged",
  "gen.md.thScore": "Score",
};
