import { prisma } from "@/lib/prisma";
import { buildReportCsv } from "@/lib/reports/csv";
import { buildReportEmailHtml, sendEmail } from "@/lib/reports/email";
import { makeT } from "@/lib/i18n/dictionaries";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";

/**
 * Envía un reporte por email a los destinatarios (HTML + CSV adjunto) y registra
 * cada entrega en ReportDelivery. Reutilizado por el envío manual y el cron.
 */
export async function deliverReportByEmail(
  reportId: string,
  recipients: string[],
  locale: Locale = DEFAULT_LOCALE,
): Promise<{ ok: boolean; error?: string; sent: number }> {
  const t = makeT(locale);
  const valid = recipients
    .map((r) => r.trim().toLowerCase())
    .filter((r) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r));
  if (valid.length === 0) return { ok: false, error: "Sin destinatarios válidos.", sent: 0 };

  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) return { ok: false, error: "Reporte no encontrado.", sent: 0 };

  const day = new Date(report.periodEnd).toISOString().slice(0, 10);
  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const html = buildReportEmailHtml(report, appUrl, locale);
  const csv = buildReportCsv(report, locale);

  const result = await sendEmail({
    to: valid,
    subject: t("exp.email.subject", { day }),
    html,
    csv: { filename: `reporte-${day}.csv`, content: csv },
  });

  await prisma.reportDelivery.createMany({
    data: valid.map((recipient) => ({
      reportId: report.id,
      channel: "EMAIL" as const,
      recipient,
      status: result.ok ? ("SENT" as const) : ("ERROR" as const),
      sentAt: result.ok ? new Date() : null,
      errorMessage: result.ok ? null : result.error ?? "Error",
    })),
  });

  if (result.ok && report.status !== "SENT") {
    await prisma.report.update({
      where: { id: report.id },
      data: { status: "SENT" },
    });
  }

  return { ok: result.ok, error: result.error, sent: valid.length };
}
