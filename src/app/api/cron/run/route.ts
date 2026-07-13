import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createReportForProject } from "@/lib/reports/create";
import { deliverReportByEmail } from "@/lib/reports/deliver";
import { isLocale, DEFAULT_LOCALE } from "@/lib/i18n/config";

// Cron de envíos programados. Pensado para que lo dispare un scheduler externo
// (Vercel Cron, GitHub Actions, cron del server) una vez por día.
// Protegido con CRON_SECRET vía header "x-cron-secret".
export const runtime = "nodejs";
// Tope de ejecución (segundos). El scheduler externo debe reintentar si se corta.
export const maxDuration = 60;

const DUE_MS = 6.5 * 24 * 60 * 60 * 1000; // ~semanal
// Concurrencia acotada para no saturar integraciones/IA ni exceder maxDuration.
const CONCURRENCY = 3;

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  // Sólo por header: NUNCA por query string (quedaría en access logs de proxy/CDN). (SEC-05)
  const provided = request.headers.get("x-cron-secret");
  if (!secret || provided !== secret)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const now = Date.now();
  const configs = await prisma.reportConfig.findMany({
    where: { frequency: "WEEKLY" },
  });

  // Sólo los que están "due" y tienen destinatarios.
  const due = configs.filter(
    (c) =>
      c.projectId &&
      c.recipients.length > 0 &&
      (!c.lastRunAt || now - c.lastRunAt.getTime() >= DUE_MS),
  );

  type RunResult = {
    configId: string;
    projectId: string | null;
    ok: boolean;
    error?: string;
  };

  async function runOne(config: (typeof due)[number]): Promise<RunResult> {
    // Marca optimista ANTES de trabajar (lock): si la función se corta por
    // timeout, no se reprocesa ni se reenvía el mismo reporte en la próxima
    // corrida. El guard sobre lastRunAt evita que dos corridas concurrentes
    // tomen el mismo config. (SEC-05)
    const claimed = await prisma.reportConfig.updateMany({
      where: {
        id: config.id,
        OR: [{ lastRunAt: null }, { lastRunAt: { lt: new Date(now - DUE_MS) } }],
      },
      data: { lastRunAt: new Date() },
    });
    if (claimed.count === 0)
      return {
        configId: config.id,
        projectId: config.projectId,
        ok: false,
        error: "ya tomado por otra corrida",
      };

    try {
      const end = new Date();
      const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
      // Idioma preferido del config (campo `locale`; cast porque el cliente
      // Prisma se regenera en el entorno del usuario con `prisma generate`).
      const rawLocale = (config as { locale?: string }).locale;
      const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
      const report = await createReportForProject(
        config.projectId!,
        config.workspaceId,
        start,
        end,
        locale,
      );
      const r = await deliverReportByEmail(report.id, config.recipients, locale);
      if (!r.ok) {
        // El envío falló: revertir la marca para reintentar en la próxima corrida.
        await prisma.reportConfig
          .update({ where: { id: config.id }, data: { lastRunAt: config.lastRunAt } })
          .catch(() => {});
      }
      return {
        configId: config.id,
        projectId: config.projectId,
        ok: r.ok,
        error: r.error,
      };
    } catch (err) {
      await prisma.reportConfig
        .update({ where: { id: config.id }, data: { lastRunAt: config.lastRunAt } })
        .catch(() => {});
      return {
        configId: config.id,
        projectId: config.projectId,
        ok: false,
        error: err instanceof Error ? err.message : "error",
      };
    }
  }

  // Procesamiento en lotes acotados (no dispara N reportes en paralelo).
  const results: RunResult[] = [];
  for (let i = 0; i < due.length; i += CONCURRENCY) {
    const batch = due.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(batch.map(runOne));
    for (const s of settled) {
      if (s.status === "fulfilled") results.push(s.value);
      else
        results.push({
          configId: "?",
          projectId: null,
          ok: false,
          error: String(s.reason),
        });
    }
  }

  return NextResponse.json({ ran: results.length, results });
}
