import type { ReportMetrics, Risk } from "./types";
import type { Locale } from "@/lib/i18n/config";
import { makeT } from "@/lib/i18n/dictionaries";

interface ReportLike {
  periodStart: Date | string;
  periodEnd: Date | string;
  healthStatus: string | null;
  score?: number | null;
  scoreLevel?: string | null;
  summary: string | null;
  metrics: unknown;
  risks: unknown;
  recommendations: unknown;
}

type Line = { text: string; bold?: boolean; size?: number; gap?: number };

// --- Sanitizado a WinAnsi (Latin-1) para el subset de fuentes estándar ---
function sanitize(s: string): string {
  return s
    .replace(/[—–]/g, "-")
    .replace(/[•·]/g, "-")
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(/→/g, "->")
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/[^\x09\x0A\x20-\xFF]/g, ""); // fuera de Latin-1
}

function pdfEscape(s: string): string {
  return sanitize(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/** Corta un texto largo a ~maxChars por línea (wrap simple por palabras). */
function wrap(text: string, maxChars: number): string[] {
  const words = sanitize(text).split(/\s+/);
  const out: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > maxChars) {
      if (cur) out.push(cur);
      cur = w;
    } else {
      cur = (cur + " " + w).trim();
    }
  }
  if (cur) out.push(cur);
  return out.length ? out : [""];
}

function buildLines(report: ReportLike, locale: Locale = "es"): Line[] {
  const t = makeT(locale);
  const m = report.metrics as ReportMetrics | null;
  const risks = (report.risks as Risk[] | null) ?? [];
  const recs = (report.recommendations as string[] | null) ?? [];
  const d = (v: Date | string) =>
    new Date(v).toLocaleDateString(locale === "en" ? "en-US" : "es-AR");
  const healthLabel = report.healthStatus
    ? t(`lib.health.${report.healthStatus}`)
    : "-";
  const lines: Line[] = [];

  lines.push({ text: `DevMetrics · ${t("exp.teamReport")}`, bold: true, size: 18 });
  lines.push({
    text: `${t("exp.period")}: ${d(report.periodStart)} - ${d(report.periodEnd)}`,
    size: 10,
    gap: 6,
  });
  if (report.score != null)
    lines.push({
      text: `${t("exp.healthScore")}: ${report.score}/100 (${report.scoreLevel ?? healthLabel})`,
      bold: true,
      size: 12,
    });
  else if (report.healthStatus)
    lines.push({ text: `${t("exp.status")}: ${healthLabel}`, bold: true, size: 12 });

  if (report.summary) {
    lines.push({ text: "", size: 4 });
    for (const l of wrap(report.summary, 95)) lines.push({ text: l, size: 10 });
  }

  if (m) {
    const kv: [string, string | number][] = [
      [t("exp.completionByPoints"), m.projectProgress.completionByPoints],
      [t("exp.velocity"), m.capacity.velocityPoints],
      [t("exp.completedOverCommitted"), `${m.capacity.completedPoints} / ${m.capacity.committedPoints}`],
      [t("exp.cycleTimeDays"), m.capacity.cycleTimeAvgDays ?? "-"],
      [t("exp.tasksDone"), m.workItems.done],
      [t("exp.tasksBlocked"), m.workItems.blocked],
      [t("exp.tasksStale"), m.workItems.stale],
      [t("exp.tasksCritical"), m.workItems.critical],
      [t("exp.prOpen"), m.codeChanges.open],
      [t("exp.prMerged"), m.codeChanges.merged],
      [t("exp.prWithoutReviewer"), m.codeChanges.withoutReviewer],
    ];
    if (m.quality) {
      kv.push([t("exp.bugsOpen"), m.quality.bugsOpen]);
      kv.push([t("exp.scopeCreep"), m.quality.scopeCreepPct]);
    }
    if (m.ci) kv.push([t("exp.ciFailureRate"), m.ci.failureRatePct]);

    lines.push({ text: "", size: 6 });
    lines.push({ text: t("exp.keyMetrics"), bold: true, size: 13 });
    for (const [k, v] of kv) lines.push({ text: `${k}: ${v}`, size: 10 });
  }

  if (risks.length > 0) {
    lines.push({ text: "", size: 6 });
    lines.push({ text: t("exp.risks"), bold: true, size: 13 });
    for (const r of risks)
      for (const l of wrap(`[${r.level}] ${r.title} — ${r.detail}`, 95))
        lines.push({ text: l, size: 10 });
  }

  if (recs.length > 0) {
    lines.push({ text: "", size: 6 });
    lines.push({ text: t("exp.recommendations"), bold: true, size: 13 });
    for (const r of recs)
      for (const l of wrap(`- ${r}`, 95)) lines.push({ text: l, size: 10 });
  }

  lines.push({ text: "", size: 10 });
  lines.push({
    text: `${t("exp.generatedBy")} · ${new Date().toLocaleString(locale === "en" ? "en-US" : "es-AR")}`,
    size: 8,
  });
  return lines;
}

/**
 * Generador de PDF sin dependencias: compone un PDF válido (multipágina) con
 * las fuentes estándar Helvetica/Helvetica-Bold (WinAnsi). Suficiente para un
 * reporte legible y descargable, sin librerías externas.
 */
export function buildReportPdf(report: ReportLike, locale: Locale = "es"): Buffer {
  const lines = buildLines(report, locale);

  // Layout
  const pageW = 612;
  const pageH = 792;
  const marginX = 54;
  const top = 748;
  const bottom = 54;

  // Paginar
  type Page = Line[];
  const pages: Page[] = [];
  let cur: Page = [];
  let y = top;
  for (const ln of lines) {
    const size = ln.size ?? 11;
    const lh = size + 5 + (ln.gap ?? 0);
    if (y - lh < bottom) {
      pages.push(cur);
      cur = [];
      y = top;
    }
    cur.push(ln);
    y -= lh;
  }
  if (cur.length) pages.push(cur);
  if (pages.length === 0) pages.push([{ text: makeT(locale)("exp.emptyReport") }]);

  // Construir content streams
  const contentStreams = pages.map((page) => {
    let yy = top;
    let out = "";
    for (const ln of page) {
      const size = ln.size ?? 11;
      const lh = size + 5 + (ln.gap ?? 0);
      const font = ln.bold ? "/F2" : "/F1";
      if (ln.text) {
        out += `BT ${font} ${size} Tf ${marginX} ${yy} Td (${pdfEscape(ln.text)}) Tj ET\n`;
      }
      yy -= lh;
    }
    return out;
  });

  // Objetos PDF
  // 1 Catalog, 2 Pages, 3 F1, 4 F2, luego por página: Page + Content
  const objects: string[] = [];
  const pageObjNums: number[] = [];
  const firstPageObj = 5;
  for (let i = 0; i < pages.length; i++) {
    pageObjNums.push(firstPageObj + i * 2);
  }

  objects[1] = `<< /Type /Catalog /Pages 2 0 R >>`;
  objects[2] = `<< /Type /Pages /Kids [${pageObjNums
    .map((n) => `${n} 0 R`)
    .join(" ")}] /Count ${pages.length} >>`;
  objects[3] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`;
  objects[4] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`;

  for (let i = 0; i < pages.length; i++) {
    const pageNum = firstPageObj + i * 2;
    const contentNum = pageNum + 1;
    objects[pageNum] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentNum} 0 R >>`;
    const stream = contentStreams[i];
    objects[contentNum] =
      `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}endstream`;
  }

  // Serializar con xref
  const total = firstPageObj + pages.length * 2 - 1;
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let n = 1; n <= total; n++) {
    offsets[n] = Buffer.byteLength(pdf, "latin1");
    pdf += `${n} 0 obj\n${objects[n]}\nendobj\n`;
  }
  const xrefStart = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${total + 1}\n`;
  pdf += `0000000000 65535 f \n`;
  for (let n = 1; n <= total; n++) {
    pdf += `${String(offsets[n]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${total + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdf, "latin1");
}
