import type { ReportMetrics, Risk } from "./types";

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

function buildLines(report: ReportLike): Line[] {
  const m = report.metrics as ReportMetrics | null;
  const risks = (report.risks as Risk[] | null) ?? [];
  const recs = (report.recommendations as string[] | null) ?? [];
  const d = (v: Date | string) => new Date(v).toLocaleDateString();
  const lines: Line[] = [];

  lines.push({ text: "DevMetrics · Reporte del equipo", bold: true, size: 18 });
  lines.push({
    text: `Período: ${d(report.periodStart)} - ${d(report.periodEnd)}`,
    size: 10,
    gap: 6,
  });
  if (report.score != null)
    lines.push({
      text: `Score de salud: ${report.score}/100 (${report.scoreLevel ?? report.healthStatus ?? "-"})`,
      bold: true,
      size: 12,
    });
  else if (report.healthStatus)
    lines.push({ text: `Estado: ${report.healthStatus}`, bold: true, size: 12 });

  if (report.summary) {
    lines.push({ text: "", size: 4 });
    for (const l of wrap(report.summary, 95)) lines.push({ text: l, size: 10 });
  }

  if (m) {
    const kv: [string, string | number][] = [
      ["Avance por SP (%)", m.projectProgress.completionByPoints],
      ["Velocity", m.capacity.velocityPoints],
      ["SP completados / comprometidos", `${m.capacity.completedPoints} / ${m.capacity.committedPoints}`],
      ["Cycle time (días)", m.capacity.cycleTimeAvgDays ?? "-"],
      ["Tareas finalizadas", m.workItems.done],
      ["Tareas bloqueadas", m.workItems.blocked],
      ["Tareas sin movimiento", m.workItems.stale],
      ["Tareas críticas", m.workItems.critical],
      ["PR/MR abiertos", m.codeChanges.open],
      ["PR/MR mergeados", m.codeChanges.merged],
      ["PR/MR sin reviewer", m.codeChanges.withoutReviewer],
    ];
    if (m.quality) {
      kv.push(["Bugs abiertos", m.quality.bugsOpen]);
      kv.push(["Scope creep (%)", m.quality.scopeCreepPct]);
    }
    if (m.ci) kv.push(["CI tasa de fallo (%)", m.ci.failureRatePct]);

    lines.push({ text: "", size: 6 });
    lines.push({ text: "Métricas clave", bold: true, size: 13 });
    for (const [k, v] of kv) lines.push({ text: `${k}: ${v}`, size: 10 });
  }

  if (risks.length > 0) {
    lines.push({ text: "", size: 6 });
    lines.push({ text: "Riesgos", bold: true, size: 13 });
    for (const r of risks)
      for (const l of wrap(`[${r.level}] ${r.title} — ${r.detail}`, 95))
        lines.push({ text: l, size: 10 });
  }

  if (recs.length > 0) {
    lines.push({ text: "", size: 6 });
    lines.push({ text: "Recomendaciones", bold: true, size: 13 });
    for (const r of recs)
      for (const l of wrap(`- ${r}`, 95)) lines.push({ text: l, size: 10 });
  }

  lines.push({ text: "", size: 10 });
  lines.push({
    text: `Generado por DevMetrics · ${new Date().toLocaleString()}`,
    size: 8,
  });
  return lines;
}

/**
 * Generador de PDF sin dependencias: compone un PDF válido (multipágina) con
 * las fuentes estándar Helvetica/Helvetica-Bold (WinAnsi). Suficiente para un
 * reporte legible y descargable, sin librerías externas.
 */
export function buildReportPdf(report: ReportLike): Buffer {
  const lines = buildLines(report);

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
  if (pages.length === 0) pages.push([{ text: "Reporte vacío" }]);

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
