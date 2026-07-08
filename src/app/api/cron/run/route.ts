import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createReportForProject } from "@/lib/reports/create";
import { deliverReportByEmail } from "@/lib/reports/deliver";

// Cron de envíos programados. Pensado para que lo dispare un scheduler externo
// (Vercel Cron, GitHub Actions, cron del server) una vez por día.
// Protegido con CRON_SECRET: header "x-cron-secret" o query ?secret=.
const DUE_MS = 6.5 * 24 * 60 * 60 * 1000; // ~semanal

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const provided =
    request.headers.get("x-cron-secret") ??
    new URL(request.url).searchParams.get("secret");
  if (!secret || provided !== secret)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const now = Date.now();
  const configs = await prisma.reportConfig.findMany({
    where: { frequency: "WEEKLY" },
  });

  const results: { projectId: string | null; ok: boolean; error?: string }[] = [];
  for (const config of configs) {
    if (!config.projectId || config.recipients.length === 0) continue;
    if (config.lastRunAt && now - config.lastRunAt.getTime() < DUE_MS) continue;

    try {
      const end = new Date();
      const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
      const report = await createReportForProject(
        config.projectId,
        config.workspaceId,
        start,
        end,
      );
      const r = await deliverReportByEmail(report.id, config.recipients);
      await prisma.reportConfig.update({
        where: { id: config.id },
        data: { lastRunAt: new Date() },
      });
      results.push({ projectId: config.projectId, ok: r.ok, error: r.error });
    } catch (err) {
      results.push({
        projectId: config.projectId,
        ok: false,
        error: err instanceof Error ? err.message : "error",
      });
    }
  }

  return NextResponse.json({ ran: results.length, results });
}
