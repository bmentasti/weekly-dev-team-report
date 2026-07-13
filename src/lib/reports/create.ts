import { prisma } from "@/lib/prisma";
import { generateReportComputation } from "@/lib/reports/generate";
import { getEffectiveStandard } from "@/lib/reports/standards-server";
import { scoreWithStandard } from "@/lib/reports/standards";
import { effectivePlan } from "@/lib/plans";
import { healthScore, levelOf } from "@/lib/reports/score";
import { loadConnectionContext } from "@/lib/integrations/loader";
import {
  demoAiAnalysis,
  generateAiAnalysis,
  isAiDemo,
  modelFor,
  type AiType,
} from "@/lib/reports/ai";
import type { IntegrationType, Prisma } from "@prisma/client";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";

const AI_TYPES: AiType[] = ["ANTHROPIC", "OPENAI", "GEMINI", "COPILOT"];

/**
 * Genera y persiste un reporte para un proyecto en un período. Incluye el
 * análisis con IA si el workspace es Pro y hay un proveedor de IA conectado.
 * Reutilizado por la generación manual y por el cron de envíos programados.
 */
export async function createReportForProject(
  projectId: string,
  workspaceId: string,
  periodStart: Date,
  periodEnd: Date,
  locale: Locale = DEFAULT_LOCALE,
): Promise<{ id: string }> {
  const c = await generateReportComputation(
    projectId,
    periodStart,
    periodEnd,
    locale,
  );

  let aiAnalysis: string | null = null;
  let aiProvider: string | null = null;
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
  });
  if (effectivePlan(workspace) === "PRO") {
    const aiIntegration = await prisma.integration.findFirst({
      where: {
        projectId,
        status: "CONNECTED",
        type: { in: AI_TYPES as unknown as IntegrationType[] },
      },
    });
    if (aiIntegration) {
      const loaded = await loadConnectionContext(projectId, aiIntegration.type);
      if (loaded) {
        const type = aiIntegration.type as unknown as AiType;
        aiAnalysis = isAiDemo(loaded.ctx.config)
          ? demoAiAnalysis(c.metrics, c.healthStatus)
          : await generateAiAnalysis(
              type,
              loaded.ctx.secret,
              modelFor(type, loaded.ctx.config),
              c.metrics,
              c.summary,
              c.healthStatus,
              locale,
            );
        if (aiAnalysis) aiProvider = type;
      }
    }
  }

  // Snapshot del score con el estándar vigente (H3): se congela al generar.
  // Usa la herencia workspace ← proyecto.
  const standard = await getEffectiveStandard(workspaceId, projectId);
  const sc = scoreWithStandard(c.metrics, standard);
  const scoreSnapshot = sc.score ?? healthScore(c.metrics, c.healthStatus);
  const levelSnapshot =
    sc.level === "SIN_DATOS" ? levelOf(scoreSnapshot) : sc.level;

  const data = {
    workspaceId,
    projectId,
    periodStart,
    periodEnd,
    status: "GENERATED",
    healthStatus: c.healthStatus,
    score: scoreSnapshot,
    scoreLevel: levelSnapshot,
    standardVersion: new Date().toISOString(),
    summary: c.summary,
    metrics: c.metrics as unknown as Prisma.InputJsonValue,
    risks: c.risks as unknown as Prisma.InputJsonValue,
    recommendations: c.recommendations as unknown as Prisma.InputJsonValue,
    rawData: {
      markdown: c.markdown,
      highlights: c.highlights,
      sourcesWithError: c.sourcesWithError,
      aiAnalysis,
      aiProvider,
    } as unknown as Prisma.InputJsonValue,
  } as unknown as Prisma.ReportUncheckedCreateInput;

  const report = await prisma.report.create({ data });
  return { id: report.id };
}
