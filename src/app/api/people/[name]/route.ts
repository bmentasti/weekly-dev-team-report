import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveActiveProject } from "@/lib/project";
import { canAccessPeople } from "@/lib/reports/people-access";
import {
  computeTier,
  type PersonProfile,
  type PersonSprintPoint,
} from "@/lib/reports/people-profile";
import {
  computeEvaluationConfidence,
  participantMappingCoverage,
  traceabilityCoverage,
  gateVerdict,
  providerCategory,
} from "@/lib/reports/evaluation-confidence";
import { comparePersonToSelf, type PersonHistoryPoint } from "@/lib/reports/person-history";
import { classifyMetric } from "@/lib/reports/metric-value";
import { computeDimensions } from "@/lib/reports/evaluation-dimensions";
import { makeResolver } from "@/lib/reports/identity";
import { getIdentityConfig } from "@/lib/reports/identity-store";
import {
  selectParticipant,
  buildIntegrationAccounts,
  primaryEmailOf,
} from "@/lib/reports/participant-detail";
import type { PersonInsight, ReportMetrics } from "@/lib/reports/types";

export async function GET(
  request: Request,
  { params }: { params: { name: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  // Scope EXPLÍCITO por proyecto: la vista de detalle debe pertenecer al mismo
  // proyecto del reporte, no al "proyecto activo". Si el caller pasa projectId
  // (p. ej. desde el reporte), se usa ese; si no, cae al activo (retro-compat).
  const explicitProjectId =
    new URL(request.url).searchParams.get("projectId") ?? undefined;
  const project = await resolveActiveProject(session.user.id, explicitProjectId);
  if (project && !(await canAccessPeople(session.user.id, project.workspaceId)))
    return NextResponse.json(
      { error: "Sin permiso para ver datos por persona." },
      { status: 403 },
    );
  if (!project)
    return NextResponse.json({ error: "No tenés un proyecto." }, { status: 400 });

  // El segmento de ruta es la CLAVE del participante: preferentemente el id
  // canónico estable; se acepta el nombre visible solo por retro-compat.
  const key = decodeURIComponent(params.name);

  const [reports, identityConfig] = await Promise.all([
    prisma.report.findMany({
      where: { projectId: project.id },
      orderBy: { periodEnd: "asc" },
      take: 10,
      select: { periodEnd: true, metrics: true },
    }),
    getIdentityConfig(project.id),
  ]);
  const resolve = makeResolver(identityConfig);

  // Selección por IDENTIDAD CANÓNICA (no por índice ni por nombre crudo).
  const reportRows = reports.map((r) => ({
    periodEnd: r.periodEnd,
    people: ((r.metrics as ReportMetrics | null)?.people ?? []) as PersonInsight[],
  }));
  const { matches, participantId } = selectParticipant(reportRows, key, resolve);

  const points: PersonSprintPoint[] = [];
  let latest: PersonInsight | null = null;
  let latestMetrics: ReportMetrics | null = null;
  for (const r of reports) {
    const m = r.metrics as ReportMetrics | null;
    if (m) latestMetrics = m; // último reporte con métricas (orden asc)
  }
  for (const { periodEnd, person } of matches) {
    latest = person;
    points.push({
      label: new Date(periodEnd).toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "2-digit",
      }),
      tasksDone: person.tasksDone,
      throughput: person.throughput,
      completedPoints: person.completedPoints,
      blocked: person.tasksBlocked,
      stale: person.tasksStale,
      tier: computeTier(person),
    });
  }

  let trend: PersonProfile["trend"] = "flat";
  if (points.length >= 2) {
    const a = points[points.length - 1].throughput;
    const b = points[points.length - 2].throughput;
    trend = a > b ? "up" : a < b ? "down" : "flat";
  }

  const tier = computeTier(latest);
  // Nombre para mostrar: el de la persona resuelta (no la clave de la URL).
  const displayName = latest?.name ?? key;
  const resolvedId = participantId ?? latest?.id ?? key;
  const profile: PersonProfile = {
    name: displayName,
    points,
    latest,
    tier,
    trend,
  };

  // --- Identidad / procedencia (auditoría §objetivo + §3) ---
  const integrationAccounts = buildIntegrationAccounts(
    identityConfig.aliases,
    resolvedId,
  );
  const primaryEmail = primaryEmailOf(resolvedId, identityConfig.aliases);
  const identity = {
    participantId: resolvedId,
    projectId: project.id,
    displayName,
    primaryEmail,
    emailAliases: integrationAccounts
      .map((a) => a.email)
      .filter((e): e is string => !!e),
    integrationAccounts,
    // Diferencia "sin actividad" de "no vinculada": si no hay filas, la persona
    // no apareció en ningún reporte del período/proyecto.
    found: matches.length > 0,
    periodsMatched: matches.length,
  };

  // --- Confianza de la evaluación (spec §7) ---
  const people = latestMetrics?.people ?? [];
  const sources = (latestMetrics?.sources ?? []).map((s) => String(s));
  // Completitud (proxy honesto): fracción de grupos de métricas con datos.
  const groupsWithData = latestMetrics
    ? [
        (latestMetrics.workItems?.total ?? 0) > 0,
        (latestMetrics.codeChanges?.total ?? 0) > 0,
        (latestMetrics.ci?.total ?? 0) > 0,
        (latestMetrics.quality?.bugs ?? 0) > 0,
      ].filter(Boolean).length / 4
    : 0;
  const confidence = computeEvaluationConfidence({
    connectedProviders: sources,
    requiredCategories: ["planning", "code"],
    participantMappingCoverage: participantMappingCoverage(people),
    dataCompleteness: groupsWithData,
    traceabilityCoverage: traceabilityCoverage(people),
  });

  // Comparación contra el PROPIO historial (spec §6: self > ranking entre pares).
  const historyPoints: PersonHistoryPoint[] = points.map((p) => ({
    label: p.label,
    tasksDone: p.tasksDone,
    throughput: p.throughput,
    completedPoints: p.completedPoints,
    blocked: p.blocked,
    stale: p.stale,
    tier: p.tier,
  }));
  const selfComparison = comparePersonToSelf(historyPoints);

  // Compuerta: con confianza baja NO se muestra veredicto categórico; en su
  // lugar, qué datos corregir/completar primero.
  const gated = gateVerdict(tier, confidence);

  // --- Estados por métrica (auditoría §6): 0 real vs sin datos vs no vinculada ---
  const planningConnected = sources.some((s) => providerCategory(s) === "planning");
  const codeConnected = sources.some((s) => providerCategory(s) === "code");
  const hasCodeAccount = integrationAccounts.some(
    (a) => providerCategory(a.provider) === "code",
  );
  const prCount = (latest?.prsMerged ?? 0) + (latest?.prsOpen ?? 0);
  // Vinculada a código si tiene cuenta de code o si se le atribuyeron PRs.
  const codeLinked = hasCodeAccount || prCount > 0;
  const planningLinked = matches.length > 0;
  const planningCtx = { providerConnected: planningConnected, personLinked: planningLinked };
  const codeCtx = { providerConnected: codeConnected, personLinked: codeLinked };
  const metricStates = latest
    ? {
        tasksDone: classifyMetric(latest.tasksDone, planningCtx),
        completedPoints: classifyMetric(latest.completedPoints, planningCtx),
        wip: classifyMetric(latest.wip, planningCtx),
        tasksBlocked: classifyMetric(latest.tasksBlocked, planningCtx),
        tasksStale: classifyMetric(latest.tasksStale, planningCtx),
        throughput: classifyMetric(latest.throughput, planningCtx),
        prsMerged: classifyMetric(latest.prsMerged, codeCtx),
        prsOpen: classifyMetric(latest.prsOpen, codeCtx),
      }
    : null;

  // --- Evaluación multidimensional (auditoría §8) ---
  const evaluation = computeDimensions(latest, {
    throughputSeries: points.map((p) => p.throughput),
    hasCode: codeConnected,
    hasPlanning: planningConnected,
  });

  return NextResponse.json({
    profile,
    identity,
    confidence,
    metricStates,
    evaluation,
    selfComparison,
    verdict: {
      show: gated.show,
      tier: gated.show ? tier : null,
      fixFirst: gated.fixFirst,
    },
  });
}
