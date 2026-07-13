import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const access = await getReportAccess(session.user.id, params.id);
  if (!access) return NextResponse.json({ error: "Sin acceso" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as {
    prompt?: string;
    role?: string;
  };
  const rawQuestion = (body.prompt ?? "").trim();
  if (!rawQuestion)
    return NextResponse.json({ error: "Escribí una pregunta." }, { status: 400 });
  // Cota de longitud para controlar coste/abuso de la IA. (COD-01)
  if (rawQuestion.length > 2000)
    return NextResponse.json(
      { error: "La pregunta es demasiado larga (máx. 2000 caracteres)." },
      { status: 400 },
    );

  const ROLE_FRAMING: Record<string, string> = {
    TL: "Respondé desde la perspectiva de un Tech Lead (foco: PRs, calidad, CI, bloqueos técnicos, riesgos de código).",
    PO: "Respondé desde la perspectiva de un Product Owner (foco: avance vs objetivo, valor, alcance, prioridades).",
    DIR: "Respondé desde la perspectiva de un Director (foco: estado general, riesgos a escalar, previsibilidad, decisiones).",
  };
  const framing = body.role ? ROLE_FRAMING[body.role] : undefined;
  const question = framing ? `${framing}\n\n${rawQuestion}` : rawQuestion;

  const report = await prisma.report.findUnique({ where: { id: params.id } });
  if (!report || !report.projectId)
    return NextResponse.json({ error: "Reporte no encontrado." }, { status: 404 });

  // Requiere plan Pro.
  const workspace = await prisma.workspace.findUnique({
    where: { id: report.workspaceId },
  });
  if (effectivePlan(workspace) !== "PRO")
    return NextResponse.json(
      { error: "El asistente de IA está disponible en el plan Pro." },
      { status: 403 },
    );

  const aiIntegration = await prisma.integration.findFirst({
    where: {
      projectId: report.projectId,
      status: "CONNECTED",
      type: { in: AI_TYPES as unknown as IntegrationType[] },
    },
  });
  if (!aiIntegration)
    return NextResponse.json(
      { error: "Conectá un proveedor de IA (Claude, ChatGPT, Gemini o Copilot)." },
      { status: 400 },
    );

  const loaded = await loadConnectionContext(report.projectId, aiIntegration.type);
  if (!loaded)
    return NextResponse.json({ error: "No se pudo cargar la IA." }, { status: 400 });

  if (isAiDemo(loaded.ctx.config)) {
    return NextResponse.json({
      answer: demoAiAnswer(question, report.summary ?? ""),
    });
  }

  const context = JSON.stringify({
    period: { start: report.periodStart, end: report.periodEnd },
    health: report.healthStatus,
    summary: report.summary,
    metrics: report.metrics,
    risks: report.risks,
    recommendations: report.recommendations,
  });

  const type = aiIntegration.type as unknown as AiType;
  const r = await askReport(
    type,
    loaded.ctx.secret,
    modelFor(type, loaded.ctx.config),
    context,
    question,
  );

  if (!r.ok)
    return NextResponse.json(
      { error: r.error ?? "La IA no pudo responder." },
      { status: 502 },
    );

  return NextResponse.json({ answer: r.text ?? "" });
}
