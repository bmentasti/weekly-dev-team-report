import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveActiveProject } from "@/lib/project";
import { getReportAccess } from "@/lib/reports/access";
import { loadConnectionContext } from "@/lib/integrations/loader";
import {
  askReport,
  demoAiAnswer,
  isAiDemo,
  modelFor,
  type AiType,
} from "@/lib/reports/ai";
import { effectivePlan } from "@/lib/plans";
import type { IntegrationType } from "@prisma/client";

const AI_TYPES: AiType[] = ["ANTHROPIC", "OPENAI", "GEMINI", "COPILOT"];

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    aId?: string;
    bId?: string;
    prompt?: string;
  };
  if (!body.aId || !body.bId)
    return NextResponse.json({ error: "Elegí dos reportes." }, { status: 400 });

  const [accA, accB] = await Promise.all([
    getReportAccess(session.user.id, body.aId),
    getReportAccess(session.user.id, body.bId),
  ]);
  if (!accA || !accB)
    return NextResponse.json({ error: "Sin acceso a los reportes." }, { status: 403 });

  const project = await resolveActiveProject(session.user.id);
  if (!project)
    return NextResponse.json({ error: "No tenés un proyecto." }, { status: 400 });

  const workspace = await prisma.workspace.findUnique({
    where: { id: project.workspaceId },
  });
  if (effectivePlan(workspace) !== "PRO")
    return NextResponse.json(
      { error: "El análisis comparativo con IA está en el plan Pro." },
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
    return NextResponse.json({ error: "Conectá un proveedor de IA." }, { status: 400 });

  const [a, b] = await Promise.all([
    prisma.report.findUnique({ where: { id: body.aId } }),
    prisma.report.findUnique({ where: { id: body.bId } }),
  ]);
  if (!a || !b)
    return NextResponse.json({ error: "Reporte no encontrado." }, { status: 404 });

  const loaded = await loadConnectionContext(project.id, aiIntegration.type);
  if (!loaded)
    return NextResponse.json({ error: "No se pudo cargar la IA." }, { status: 400 });

  const question =
    (body.prompt?.trim() ||
      "Compará ambos sprints como Agile Delivery Manager: si el equipo mejoró/empeoró/estable, causas probables, tendencias, alertas, hipótesis de causa raíz y acciones por rol (TL/PO/Director) y para el próximo planning. Si falta un dato, decilo.") +
    "\n(Español, ejecutivo y accionable; sin conclusiones exageradas si faltan datos.)";

  const context = JSON.stringify({
    sprintReciente: { periodo: [a.periodStart, a.periodEnd], salud: a.healthStatus, resumen: a.summary, metrics: a.metrics },
    sprintAnterior: { periodo: [b.periodStart, b.periodEnd], salud: b.healthStatus, resumen: b.summary, metrics: b.metrics },
  });

  if (isAiDemo(loaded.ctx.config)) {
    return NextResponse.json({
      answer: demoAiAnswer(question, `Comparación entre ${a.summary ?? ""} y ${b.summary ?? ""}`),
    });
  }

  const type = aiIntegration.type as unknown as AiType;
  const r = await askReport(type, loaded.ctx.secret, modelFor(type, loaded.ctx.config), context, question);
  if (!r.ok)
    return NextResponse.json({ error: r.error ?? "La IA no respondió." }, { status: 502 });
  return NextResponse.json({ answer: r.text ?? "" });
}
