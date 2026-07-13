// Backfill: re-etiqueta los puntos del gráfico de tendencia de reportes YA
// generados. Los reportes viejos guardaron cada punto con solo la fecha de fin
// del período ("13/7"), que se repetía cuando varios reportes terminaban el
// mismo día. Este script los reescribe con el rango del período ("14/4–13/7"),
// igual que los reportes nuevos.
//
// Uso:  node scripts/backfill-trend-labels.mjs
// (lee DATABASE_URL de .env; no modifica métricas, solo labels de trend)

import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

// Carga mínima de .env (sin dependencia de dotenv).
try {
  for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  // sin .env: se asume DATABASE_URL ya presente en el entorno
}

const prisma = new PrismaClient();

// Etiqueta vieja: solo "d/m" (ej. "13/7"). Las nuevas son rangos "d/m–d/m".
const OLD_LABEL = /^\d{1,2}\/\d{1,2}$/;
const fmt = (d) => d.toLocaleDateString("es-AR", { day: "numeric", month: "numeric" });
const rangeLabel = (s, e) => `${fmt(new Date(s))}–${fmt(new Date(e))}`;

const reports = await prisma.report.findMany({
  orderBy: { createdAt: "asc" },
  select: {
    id: true,
    createdAt: true,
    projectId: true,
    periodStart: true,
    periodEnd: true,
    metrics: true,
  },
});

let updated = 0;
let skipped = 0;

for (const r of reports) {
  const m = r.metrics;
  if (!m || !Array.isArray(m.trend) || m.trend.length < 2) continue;

  // Último punto = "Actual" (el propio reporte); los anteriores corresponden a
  // los reportes previos del mismo proyecto, en orden de creación (así los
  // armaba el código viejo).
  const prevPoints = m.trend.slice(0, -1);
  if (!prevPoints.some((p) => OLD_LABEL.test(p?.label ?? ""))) continue; // ya migrado

  const candidates = reports
    .filter((x) => x.projectId === r.projectId && x.createdAt < r.createdAt)
    .slice(-prevPoints.length);

  if (candidates.length !== prevPoints.length) {
    // No se puede reconstruir con certeza (ej. reportes borrados): no tocar.
    skipped++;
    continue;
  }

  for (let i = 0; i < prevPoints.length; i++) {
    if (OLD_LABEL.test(prevPoints[i]?.label ?? "")) {
      prevPoints[i].label = rangeLabel(candidates[i].periodStart, candidates[i].periodEnd);
    }
  }

  await prisma.report.update({ where: { id: r.id }, data: { metrics: m } });
  updated++;
}

console.log(`Reportes actualizados: ${updated}`);
console.log(`Sin match confiable (no tocados): ${skipped}`);
await prisma.$disconnect();
