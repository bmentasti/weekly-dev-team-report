import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveActiveProject } from "@/lib/project";
import { canAccessPeople } from "@/lib/reports/people-access";
import { loadConnectionContext } from "@/lib/integrations/loader";
import {
  askReport,
  demoAiAnswer,
  isAiDemo,
  modelFor,
  type AiType,
} from "@/lib/reports/ai";
import { computeTier, TIER_LABEL } from "@/lib/reports/people-profile";
import type { PersonInsight, ReportMetrics } from "@/lib/reports/types";
import { effectivePlan } from "@/lib/plans";
import type { IntegrationType } from "@prisma/client";

const AI_TYPES: AiType[] = ["ANTHROPIC", "OPENAI", "GEMINI", "COPILOT"];

export async function POST(
  _request: Request,
  { params }: { params: { name: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const project = await resolveActiveProject(session.user.id);
  if (project && !(await canAccessPeople(session.user.id, project.workspaceId)))
    return NextResponse.json(
      { error: "Sin permiso para ver datos por persona." },
      { status: 403 },
    );
  if (!project)
    return NextResponse.json({ error: "No tenés un proyecto." }, { status: 400 });

  const workspace = await prisma.workspace.findUnique({
    where: { id: project.workspaceId },
  });
  if (effectivePlan(workspace) !== "PRO")
    return NextResponse.json(
      { error: "El análisis 1:1 con IA está en el plan Pro." },
      { status: 403 },
    );

  const aiIntegration = await prisma.integration.findFirst({
    where: {
      projectId: project.id,
      status: "CONNECTED",
      type: { in: AI_TYPES as unknown as IntegrationType[] },
    },
  });
  if (!aiIntegration)
    return NextResponse.json(
      { error: "Conectá un proveedor de IA." },
      { status: 400 },
    );

  const name = decodeURIComponent(params.name);
  // Datos recientes de la persona.
  const reports = await prisma.report.findMany({
    where: { projectId: project.id },
    orderBy: { periodEnd: "desc" },
    take: 4,
    select: { metrics: true },
  });
  let latest: PersonInsight | null = null;
  const series: PersonInsight[] = [];
  for (const r of reports) {
    const m = r.metrics as ReportMetrics | null;
    const person = m?.people?.find((p) => p.name === name);
    if (person) {
      if (!latest) latest = person;
      series.push(person);
    }
  }

  const loaded = await loadConnectionContext(project.id, aiIntegration.type);
  if (!loaded)
    return NextResponse.json({ error: "No se pudo cargar la IA." }, { status: 400 });

  const question = `Actuá como People Manager con mirada humana y justa. NO uses etiquetas agresivas ni conclusiones definitivas sin evidencia repetida. Para ${name} (clasificación tentativa: ${TIER_LABEL[computeTier(latest)]}), devolvé: 1) posibles hipótesis de contexto, 2) un plan de acompañamiento 1:1 (preguntas + pasos), 3) objetivo medible para el próximo sprint. Basate solo en los datos.`;
  const context = JSON.stringify({ persona: name, ultimosSprints: series });

  if (isAiDemo(loaded.ctx.config)) {
    return NextResponse.json({
      answer: demoAiAnswer(question, `Perfil de ${name} en los últimos sprints.`),
    });
  }

  const type = aiIntegration.type as unknown as AiType;
  const r = await askReport(
    type,
    loaded.ctx.secret,
    modelFor(type, loaded.ctx.config),
    context,
    question,
  );
  if (!r.ok)
    return NextResponse.json({ error: r.error ?? "La IA no respondió." }, { status: 502 });
  return NextResponse.json({ answer: r.text ?? "" });
}
