import type { ReportMetrics } from "./types";
import type { HealthLevel } from "./types";
import { makeT } from "@/lib/i18n/dictionaries";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import { formatDate } from "@/lib/utils";

interface ReportLike {
  id: string;
  periodStart: Date | string;
  periodEnd: Date | string;
  healthStatus: string | null;
  summary: string | null;
  metrics: unknown;
  recommendations: unknown;
}

export function buildReportEmailHtml(
  report: ReportLike,
  appUrl: string,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const t = makeT(locale);
  const m = report.metrics as ReportMetrics | null;
  const recs = (report.recommendations as string[] | null) ?? [];
  const d = (v: Date | string) => formatDate(v);
  const health = report.healthStatus as HealthLevel | null;
  const healthLabel = health ? t(`lib.health.${health}`) : "—";

  const metricLine = (label: string, value: string | number) =>
    `<tr><td style="padding:4px 0;color:#64748b;font-size:13px">${label}</td><td style="padding:4px 0;text-align:right;font-weight:600;font-size:13px">${value}</td></tr>`;

  const metricsHtml = m
    ? `<table style="width:100%;border-collapse:collapse;margin-top:8px">
        ${metricLine(t("exp.completedPoints"), `${m.capacity.completedPoints}/${m.capacity.committedPoints}`)}
        ${metricLine(t("exp.velocity"), `${m.capacity.velocityPoints} pts`)}
        ${metricLine(t("exp.tasksDone"), m.workItems.done)}
        ${metricLine(t("exp.tasksBlocked"), m.workItems.blocked)}
        ${metricLine(t("exp.prMerged"), m.codeChanges.merged)}
        ${metricLine(t("exp.prWithoutReviewer"), m.codeChanges.withoutReviewer)}
      </table>`
    : "";

  const recsHtml =
    recs.length > 0
      ? `<h3 style="font-size:14px;margin:20px 0 6px">${t("exp.recommendations")}</h3>
         <ul style="margin:0;padding-left:18px;color:#334155;font-size:13px">
           ${recs.map((r) => `<li style="margin:3px 0">${r}</li>`).join("")}
         </ul>`
      : "";

  return `<!doctype html><html><body style="margin:0;background:#f7f9fc;font-family:Inter,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <div style="background:#0b1d3a;color:#fff;border-radius:16px;padding:20px 24px">
      <div style="font-size:18px;font-weight:700">DevMetrics</div>
      <div style="opacity:.7;font-size:13px">${t("exp.teamReport")}</div>
    </div>
    <div style="background:#fff;border:1px solid #dce3ee;border-radius:16px;padding:24px;margin-top:12px">
      <div style="font-size:13px;color:#64748b">${d(report.periodStart)} – ${d(report.periodEnd)} · ${t("exp.status")}: <strong style="color:#0b1d3a">${healthLabel}</strong></div>
      <p style="font-size:14px;color:#334155;line-height:1.5">${report.summary ?? ""}</p>
      ${metricsHtml}
      ${recsHtml}
      <a href="${appUrl}/reports/${report.id}" style="display:inline-block;margin-top:20px;background:#2563ff;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 18px;border-radius:10px">${t("exp.email.viewFullReport")}</a>
    </div>
    <p style="text-align:center;color:#94a3b8;font-size:11px;margin-top:16px">${t("exp.email.footer")}</p>
  </div>
  </body></html>`;
}

export interface SendEmailInput {
  to: string[];
  subject: string;
  html: string;
  csv?: { filename: string; content: string };
}

export interface SendEmailResult {
  ok: boolean;
  error?: string;
}

/**
 * Sends an email via the Resend REST API. Requires RESEND_API_KEY and EMAIL_FROM.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    return {
      ok: false,
      error:
        "El envío por email no está configurado. Definí RESEND_API_KEY y EMAIL_FROM en el .env.",
    };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        attachments: input.csv
          ? [
              {
                filename: input.csv.filename,
                content: Buffer.from(input.csv.content, "utf8").toString("base64"),
              },
            ]
          : undefined,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, error: `Resend respondió ${res.status}. ${detail.slice(0, 160)}` };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al enviar el email.",
    };
  }
}
