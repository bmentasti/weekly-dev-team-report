// Seed de datos financieros de EJEMPLO para probar el módulo
// Budget, Forecast & Profitability.
//
// Uso:  node scripts/seed-finance.mjs [projectId]
//   - Sin argumento: usa el primer proyecto que encuentre.
//   - Con projectId: puebla ese proyecto.
//
// Crea/actualiza ProjectFinance (Fixed Price), captura la baseline (si no
// existe), y carga costos, ingresos y milestones de ejemplo. Idempotente:
// limpia las entradas de ejemplo previas (source = "seed") antes de recrearlas.

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

function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}
function daysFromNow(n) {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000);
}

async function main() {
  const projectId = process.argv[2];
  const project = projectId
    ? await prisma.project.findUnique({ where: { id: projectId } })
    : await prisma.project.findFirst({ orderBy: { createdAt: "asc" } });

  if (!project) {
    console.error("No se encontró ningún proyecto. Creá uno primero (o corré npm run db:seed).");
    process.exit(1);
  }
  console.log(`Sembrando finanzas en el proyecto: ${project.name} (${project.id})`);

  // --- Configuración económica (Fixed Price rentable pero con avance ajustado) ---
  await prisma.projectFinance.upsert({
    where: { projectId: project.id },
    update: {
      modality: "FIXED_PRICE",
      trackingLevel: "FULL",
      currency: "USD",
      startDate: daysAgo(120),
      plannedEndDate: daysFromNow(60),
      contractualEndDate: daysFromNow(60),
      forecastEndDate: daysFromNow(75),
      contractedRevenue: 200000,
      originalCostBudget: 150000,
      targetMarginPct: 25,
      progressMethod: "WEIGHTED_COMBINATION",
      progressConfig: { manualPct: 62, manualWeight: 0.4, milestoneWeight: 0.6 },
      workingDaysPerWeek: 5,
    },
    create: {
      projectId: project.id,
      modality: "FIXED_PRICE",
      trackingLevel: "FULL",
      currency: "USD",
      startDate: daysAgo(120),
      plannedEndDate: daysFromNow(60),
      contractualEndDate: daysFromNow(60),
      forecastEndDate: daysFromNow(75),
      contractedRevenue: 200000,
      originalCostBudget: 150000,
      targetMarginPct: 25,
      progressMethod: "WEIGHTED_COMBINATION",
      progressConfig: { manualPct: 62, manualWeight: 0.4, milestoneWeight: 0.6 },
      workingDaysPerWeek: 5,
    },
  });

  // --- Baseline inmutable (sólo si no existe) ---
  const baseline = await prisma.financeBaseline.findUnique({ where: { projectId: project.id } });
  if (!baseline) {
    await prisma.financeBaseline.create({
      data: {
        projectId: project.id,
        contractedRevenue: 200000,
        estimatedCost: 150000,
        scopeValue: 200000,
        estimatedStoryPoints: 320,
        estimatedDurationDays: 180,
        targetMarginPct: 25,
        plannedEndDate: daysFromNow(60),
        capturedByName: "seed-finance",
        reason: "Baseline de ejemplo (seed)",
      },
    });
    console.log("  Baseline capturada.");
  } else {
    console.log("  Baseline ya existía (inmutable): se respeta.");
  }

  // --- Limpieza de entradas de ejemplo previas ---
  await prisma.costEntry.deleteMany({ where: { projectId: project.id, source: "seed" } });
  await prisma.revenueEntry.deleteMany({ where: { projectId: project.id, source: "seed" } });
  await prisma.financeMilestone.deleteMany({ where: { projectId: project.id } });
  await prisma.budgetChange.deleteMany({ where: { projectId: project.id, reason: "seed" } });

  // --- Costos reales (AC ≈ 98.000, algo de comprometido y retrabajo) ---
  const costs = [
    { category: "LABOR", nature: "ACTUAL", amount: 32000, incurredOn: daysAgo(100) },
    { category: "LABOR", nature: "ACTUAL", amount: 30000, incurredOn: daysAgo(60) },
    { category: "LABOR", nature: "ACTUAL", amount: 22000, incurredOn: daysAgo(20) },
    { category: "INFRASTRUCTURE", nature: "ACTUAL", amount: 6000, incurredOn: daysAgo(45) },
    { category: "LICENSE", nature: "ACTUAL", amount: 3000, incurredOn: daysAgo(30) },
    { category: "REWORK", nature: "ACTUAL", amount: 5000, incurredOn: daysAgo(15) },
    { category: "VENDOR", nature: "COMMITTED", amount: 8000, incurredOn: daysAgo(5) },
    { category: "BLOCKER", nature: "ACTUAL", amount: 2000, incurredOn: daysAgo(12) },
    { category: "BLOCKER", nature: "POTENTIAL", amount: 4000, incurredOn: daysAgo(3) },
  ];
  for (const c of costs) {
    await prisma.costEntry.create({
      data: { projectId: project.id, currency: "USD", source: "seed", ...c },
    });
  }

  // --- Ingresos (reconocido parcial + un change request) ---
  const revenues = [
    { type: "CONTRACTED", amount: 200000, date: daysAgo(120) },
    { type: "RECOGNIZED", amount: 120000, date: daysAgo(30) },
    { type: "INVOICED", amount: 110000, date: daysAgo(25) },
    { type: "CHANGE_REQUEST", amount: 15000, date: daysAgo(10) },
  ];
  for (const r of revenues) {
    await prisma.revenueEntry.create({
      data: { projectId: project.id, currency: "USD", source: "seed", ...r },
    });
  }

  // --- Milestones (avance por hitos ponderados) ---
  const milestones = [
    { name: "Discovery", value: 40000, weight: 1, plannedDate: daysAgo(90), status: "ACCEPTED", percentComplete: 100 },
    { name: "MVP", value: 80000, weight: 2, plannedDate: daysAgo(20), status: "DELIVERED", percentComplete: 90 },
    { name: "Release", value: 80000, weight: 2, plannedDate: daysFromNow(50), status: "IN_PROGRESS", percentComplete: 25 },
  ];
  for (const m of milestones) {
    await prisma.financeMilestone.create({ data: { projectId: project.id, ...m } });
  }

  // --- Cambios de alcance (scope creep: parte aprobada, parte no) ---
  await prisma.budgetChange.create({
    data: { projectId: project.id, type: "CHANGE_REQUEST", amount: 15000, approved: true, approvedByName: "seed", reason: "seed" },
  });
  await prisma.budgetChange.create({
    data: { projectId: project.id, type: "SCOPE_CHANGE", amount: 12000, approved: false, reason: "seed" },
  });

  console.log("  Costos, ingresos, milestones, bloqueos y cambios de alcance de ejemplo cargados.");
  console.log(`\nListo. Abrí:  /projects/${project.id}/finance`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
