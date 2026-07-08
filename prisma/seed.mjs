// Seed script — creates a fixed test user, a demo workspace and a set of DEMO
// integrations (Jira, GitHub, Slack, Linear, GitLab) that return sample data
// without hitting real APIs. Lets you log in and generate a full report right
// away to see what the product produces.
//
// Run with:  npm run db:seed
//
// Credentials:
//   email:    test@test.com
//   password: password123
//
// Safe to run multiple times (idempotent).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const TEST_EMAIL = "test@test.com";
const TEST_PASSWORD = "password123";

// --- Minimal .env loader (so ENCRYPTION_KEY is available in a plain node run) ---
function loadEnv() {
  if (process.env.ENCRYPTION_KEY) return;
  try {
    const envPath = join(dirname(fileURLToPath(import.meta.url)), "..", ".env");
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // ignore — will error later if the key is truly missing
  }
}

// --- AES-256-GCM encrypt, matching src/lib/encryption.ts ---
function encrypt(plaintext) {
  const key = Buffer.from(process.env.ENCRYPTION_KEY ?? "", "hex");
  if (key.length !== 32) {
    throw new Error(
      "ENCRYPTION_KEY debe tener 32 bytes (64 hex). Revisá tu .env.",
    );
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    tag.toString("base64"),
    enc.toString("base64"),
  ].join(":");
}

// ---- Historial de sprints con distinta calidad ----
const SCN = {
  great: { total: 18, done: 16, inProgress: 2, blocked: 0, todo: 0, stale: 0, critical: 1, committed: 40, completed: 37, merged: 10, open: 2, noRev: 0, old: 0, checksFail: 0, bugs: 2, bugsDone: 2, ciTotal: 10, ciFail: 0, deployFail: 0, cycle: 2.2, health: "HEALTHY" },
  normal: { total: 16, done: 10, inProgress: 4, blocked: 1, todo: 1, stale: 1, critical: 1, committed: 34, completed: 22, merged: 7, open: 4, noRev: 1, old: 1, checksFail: 0, bugs: 3, bugsDone: 2, ciTotal: 9, ciFail: 1, deployFail: 0, cycle: 2.8, health: "MEDIUM_RISK" },
  carryover: { total: 20, done: 8, inProgress: 6, blocked: 2, todo: 4, stale: 3, critical: 2, committed: 40, completed: 18, merged: 5, open: 6, noRev: 2, old: 2, checksFail: 1, bugs: 4, bugsDone: 2, ciTotal: 8, ciFail: 1, deployFail: 0, cycle: 3.5, health: "MEDIUM_RISK" },
  bad: { total: 22, done: 5, inProgress: 7, blocked: 5, todo: 5, stale: 6, critical: 4, committed: 42, completed: 10, merged: 3, open: 8, noRev: 4, old: 4, checksFail: 2, bugs: 6, bugsDone: 1, ciTotal: 10, ciFail: 5, deployFail: 1, cycle: 4.6, health: "HIGH_RISK" },
};

const NEXT_STEP = {
  SUPPORT: "Conversar 1:1 para destrabar y priorizar.",
  OVERLOADED: "Redistribuir parte del WIP.",
  RECOGNIZE: "Reconocer el aporte; candidato/a a más impacto.",
  FREE_CAPACITY: "Tiene capacidad; asignar backlog o reviews.",
  ON_TRACK: "En ritmo; seguimiento habitual.",
};

function buildPeople(s) {
  const names = ["Ana", "Bruno", "Carla", "Diego", "Elena"];
  const arr = names.map((name, i) => {
    const tasksDone = Math.floor(s.done / 5) + (i < s.done % 5 ? 1 : 0);
    const wip = Math.floor(s.inProgress / 5) + (i < s.inProgress % 5 ? 1 : 0);
    const tasksBlocked = i < s.blocked ? 1 : 0;
    const tasksStale = i < s.stale ? 1 : 0;
    const prsMerged = Math.floor(s.merged / 5) + (i < s.merged % 5 ? 1 : 0);
    const prsOpen = Math.floor(s.open / 5);
    const completedPoints = tasksDone * 2;
    const throughput = tasksDone + prsMerged;
    const category =
      tasksBlocked > 0 || tasksStale >= 2
        ? "SUPPORT"
        : wip >= 5
          ? "OVERLOADED"
          : throughput >= 3 && tasksBlocked === 0 && tasksStale === 0
            ? "RECOGNIZE"
            : wip === 0 && throughput <= 1
              ? "FREE_CAPACITY"
              : "ON_TRACK";
    return {
      name, tasksDone, tasksInProgress: wip, tasksBlocked, tasksStale,
      prsOpen, prsMerged, committedPoints: completedPoints + wip * 2,
      completedPoints, wip, throughput, cycleTimeAvgDays: s.cycle,
      category, score: completedPoints * 2 + tasksDone * 2 + prsMerged * 3 + prsOpen,
      rank: 0, nextStep: NEXT_STEP[category],
    };
  });
  arr.sort((a, b) => b.score - a.score);
  arr.forEach((p, i) => (p.rank = i + 1));
  return arr;
}

function buildMetrics(s) {
  const r = (x) => Math.round(x);
  const carryOverItems = s.total - s.done;
  const trendV = [Math.max(s.completed - 8, 4), Math.max(s.completed - 3, 6), Math.max(s.completed - 5, 5), s.completed];
  return {
    workItems: { total: s.total, done: s.done, inProgress: s.inProgress, blocked: s.blocked, todo: s.todo, stale: s.stale, critical: s.critical },
    codeChanges: { total: s.merged + s.open, open: s.open, merged: s.merged, closedNoMerge: 0, withoutReviewer: s.noRev, checksFailing: s.checksFail, old: s.old, avgOpenAgeHours: s.old >= 3 ? 110 : s.old > 0 ? 80 : 24 },
    activity: { messages: 12, blockers: s.blocked >= 3 ? 4 : s.blocked > 0 ? 2 : 1, activePeople: 5 },
    quality: { bugs: s.bugs, bugsDone: s.bugsDone, bugsOpen: s.bugs - s.bugsDone, defectRatePct: r((s.bugs / s.total) * 100), scopeCreepItems: s.health === "HIGH_RISK" ? 6 : s.blocked > 1 ? 4 : 2, scopeCreepPct: r(((s.health === "HIGH_RISK" ? 6 : s.blocked > 1 ? 4 : 2) / s.total) * 100), readyForQa: s.inProgress },
    ci: { total: s.ciTotal, success: s.ciTotal - s.ciFail, failed: s.ciFail, running: 0, failureRatePct: r((s.ciFail / s.ciTotal) * 100), deployFailed: s.deployFail },
    capacity: { committedPoints: s.committed, completedPoints: s.completed, velocityPoints: s.completed, remainingPoints: s.committed - s.completed, cycleTimeAvgDays: s.cycle },
    projectProgress: { totalItems: s.total, doneItems: s.done, remainingItems: s.total - s.done, completionByCount: r((s.done / s.total) * 100), completionByPoints: r((s.completed / s.committed) * 100) },
    statusDistribution: { todo: s.todo, inProgress: s.inProgress, blocked: s.blocked, done: s.done },
    planning: { carryOverItems, carryOverPoints: s.committed - s.completed, forecastPoints: s.completed, focus: [] },
    trend: trendV.map((v, i) => ({ label: i < 3 ? `S${i + 1}` : "Actual", done: r(s.done * (v / s.completed || 1)), merged: r(s.merged * (v / s.completed || 1)), blocked: s.blocked, velocityPoints: v, health: null })),
    people: buildPeople(s),
    sources: ["jira", "github"],
  };
}

const SUMMARY = {
  great: "Sprint muy sólido: casi todo lo comprometido cerrado, sin bloqueos y CI en verde.",
  normal: "Sprint con buen avance pero con algunos pendientes y un bloqueo a seguir.",
  carryover: "Avance parcial con carry-over alto: mucho quedó en progreso o sin empezar.",
  bad: "Sprint en riesgo: bajo avance, varios bloqueos, bugs y fallas de CI.",
};
const RISKS = {
  great: [],
  normal: [{ level: "medium", title: "1 tarea bloqueada", detail: "Seguir en la daily." }],
  carryover: [{ level: "high", title: "Carry-over alto", detail: "Se arrastra más de lo cerrado." }],
  bad: [
    { level: "high", title: "5 tareas bloqueadas", detail: "Riesgo de no cumplir el objetivo." },
    { level: "high", title: "CI/deploys fallando", detail: "Pipeline inestable." },
  ],
};
const RECS = {
  great: ["Mantener el ritmo y el buen flujo de review."],
  normal: ["Destrabar la tarea bloqueada.", "Asignar reviewers a los PR pendientes."],
  carryover: ["Cerrar antes de tomar nuevo.", "Ajustar la capacidad comprometida."],
  bad: ["Estabilizar el pipeline.", "Priorizar bloqueos y bugs.", "Revisar alcance del sprint."],
};

async function seedHistory(workspaceId, projectId, withAi) {
  await prisma.report.deleteMany({ where: { projectId } });
  const scenarios = ["great", "normal", "carryover", "bad", "normal", "great"];
  const now = Date.now();
  for (let i = 0; i < scenarios.length; i++) {
    const scn = scenarios[i];
    const s = SCN[scn];
    // más viejo primero; cada sprint 14 días, el último termina hoy.
    const end = new Date(now - (scenarios.length - 1 - i) * 14 * 24 * 60 * 60 * 1000);
    const start = new Date(end.getTime() - 14 * 24 * 60 * 60 * 1000);
    await prisma.report.create({
      data: {
        workspaceId,
        projectId,
        periodStart: start,
        periodEnd: end,
        status: "GENERATED",
        healthStatus: s.health,
        type: "SPRINT",
        tags: scn === "bad" ? ["riesgo"] : scn === "great" ? ["estratégico"] : [],
        pinned: i === scenarios.length - 1,
        reviewedAt: i < scenarios.length - 2 ? end : null,
        summary: SUMMARY[scn],
        metrics: buildMetrics(s),
        risks: RISKS[scn],
        recommendations: RECS[scn],
        rawData: {
          markdown: `# Reporte — ${SUMMARY[scn]}`,
          highlights: { tasksDone: [], tasksAtRisk: [], prsMerged: [], prsAtRisk: [] },
          sourcesWithError: [],
          aiAnalysis: withAi ? `Lectura ejecutiva\n• ${SUMMARY[scn]}\n\nRecomendaciones\n• ${RECS[scn].join("\n• ")}` : null,
          aiProvider: withAi ? "ANTHROPIC" : null,
        },
        createdAt: end,
      },
    });
  }
}

async function main() {
  loadEnv();
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);

  const user = await prisma.user.upsert({
    where: { email: TEST_EMAIL },
    update: { passwordHash },
    create: {
      name: "Usuario de Prueba",
      email: TEST_EMAIL,
      passwordHash,
      company: "Demo Co",
      role: "TECH_LEAD",
    },
  });

  let workspace = await prisma.workspace.findFirst({
    where: { ownerId: user.id },
  });
  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: {
        name: "Equipo Frontend Demo",
        companyName: "Demo Co",
        teamName: "Frontend",
        teamSize: 8,
        ownerId: user.id,
        plan: "PRO",
        members: { create: { userId: user.id, role: "OWNER" } },
      },
    });
  } else {
    // Demo en PRO para que no choque con los límites de plan.
    await prisma.workspace.update({
      where: { id: workspace.id },
      data: { plan: "PRO" },
    });
  }

  // Teammates so "compartir" y equipos tengan a quién elegir.
  const TEAMMATES = [
    { name: "Ana", email: "ana@demo.co" },
    { name: "Bruno", email: "bruno@demo.co" },
    { name: "Carla", email: "carla@demo.co" },
    { name: "Diego", email: "diego@demo.co" },
    { name: "Elena", email: "elena@demo.co" },
  ];
  const teammateIds = {};
  for (const t of TEAMMATES) {
    const teammate = await prisma.user.upsert({
      where: { email: t.email },
      update: {},
      create: {
        name: t.name,
        email: t.email,
        passwordHash,
        company: "Demo Co",
        role: "OTHER",
      },
    });
    teammateIds[t.name] = teammate.id;
    await prisma.workspaceMember.upsert({
      where: {
        workspaceId_userId: { workspaceId: workspace.id, userId: teammate.id },
      },
      update: {},
      create: { workspaceId: workspace.id, userId: teammate.id, role: "MEMBER" },
    });
  }

  // Usuario Viewer (stakeholder) en el workspace Pro: solo lectura, sin datos
  // por persona. Sirve para probar el RBAC.
  const viewerUser = await prisma.user.upsert({
    where: { email: "viewer@demo.co" },
    update: { role: "OTHER" },
    create: {
      name: "Stakeholder Viewer",
      email: "viewer@demo.co",
      passwordHash,
      company: "Demo Co",
      role: "OTHER",
    },
  });
  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: { workspaceId: workspace.id, userId: viewerUser.id },
    },
    update: { role: "VIEWER" },
    create: { workspaceId: workspace.id, userId: viewerUser.id, role: "VIEWER" },
  });

  // Dos proyectos demo con integraciones y equipos distintos.
  async function ensureProject(name) {
    let p = await prisma.project.findFirst({
      where: { workspaceId: workspace.id, name },
    });
    if (!p)
      p = await prisma.project.create({
        data: { workspaceId: workspace.id, name },
      });
    return p;
  }
  async function ensureMember(projectId, userId, role) {
    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId, userId } },
      update: {},
      create: { projectId, userId, role },
    });
  }

  const webApp = await ensureProject("Web App");
  const mobileApp = await ensureProject("Mobile App");

  await ensureMember(webApp.id, user.id, "OWNER");
  await ensureMember(mobileApp.id, user.id, "OWNER");
  for (const n of ["Ana", "Bruno", "Carla"])
    await ensureMember(webApp.id, teammateIds[n], "MEMBER");
  for (const n of ["Diego", "Elena"])
    await ensureMember(mobileApp.id, teammateIds[n], "MEMBER");

  // Integraciones por proyecto (limpio las viejas del workspace primero).
  const token = encrypt("demo-token");
  await prisma.integration.deleteMany({ where: { workspaceId: workspace.id } });

  async function connect(projectId, type, config) {
    await prisma.integration.create({
      data: {
        workspaceId: workspace.id,
        projectId,
        type,
        status: "CONNECTED",
        config,
        encryptedAccessToken: token,
      },
    });
  }

  // Web App → Jira + GitHub + Slack
  await connect(webApp.id, "JIRA", { demo: "true", domain: "demo.atlassian.net", email: "demo@demo.co", projectKey: "FOR" });
  await connect(webApp.id, "GITHUB", { demo: "true", owner: "formar-it", repo: "web-app" });
  await connect(webApp.id, "SLACK", { demo: "true", channelId: "C0DEMO0001" });
  // Mobile App → Linear + GitLab
  await connect(mobileApp.id, "LINEAR", { demo: "true", teamKey: "ENG" });
  await connect(mobileApp.id, "GITLAB", { demo: "true", baseUrl: "https://gitlab.com", projectId: "formar-it/mobile" });
  // Web App → Claude (IA, solo Pro) en modo demo
  await connect(webApp.id, "ANTHROPIC", { demo: "true", model: "claude-3-5-sonnet-latest" });

  // --- Usuarios de ejemplo en cada plan, para ver las diferencias ---
  const CONFIG_FOR = {
    JIRA: { demo: "true", domain: "demo.atlassian.net", email: "demo@demo.co", projectKey: "FOR" },
    GITHUB: { demo: "true", owner: "formar-it", repo: "web-app" },
    SLACK: { demo: "true", channelId: "C0DEMO0001" },
    LINEAR: { demo: "true", teamKey: "ENG" },
    GITLAB: { demo: "true", baseUrl: "https://gitlab.com", projectId: "formar-it/mobile" },
  };

  async function seedPlanUser({ email, name, wsName, plan, types, role = "TECH_LEAD" }) {
    const u = await prisma.user.upsert({
      where: { email },
      update: { role },
      create: { name, email, passwordHash, company: "Demo Co", role },
    });
    let ws = await prisma.workspace.findFirst({ where: { ownerId: u.id } });
    if (!ws) {
      ws = await prisma.workspace.create({
        data: {
          name: wsName,
          ownerId: u.id,
          plan,
          members: { create: { userId: u.id, role: "OWNER" } },
        },
      });
    } else {
      await prisma.workspace.update({ where: { id: ws.id }, data: { plan } });
    }
    let proj = await prisma.project.findFirst({ where: { workspaceId: ws.id } });
    if (!proj) {
      proj = await prisma.project.create({
        data: {
          workspaceId: ws.id,
          name: "General",
          members: { create: { userId: u.id, role: "OWNER" } },
        },
      });
    }
    await prisma.integration.deleteMany({ where: { workspaceId: ws.id } });
    for (const t of types) {
      await prisma.integration.create({
        data: {
          workspaceId: ws.id,
          projectId: proj.id,
          type: t,
          status: "CONNECTED",
          config: CONFIG_FOR[t],
          encryptedAccessToken: token,
        },
      });
    }
    return { ws, proj };
  }

  // Free: 1 proyecto, solo Jira + GitHub.
  const free = await seedPlanUser({
    email: "free@demo.co",
    name: "Usuario Free",
    wsName: "Free Demo",
    plan: "FREE",
    types: ["JIRA", "GITHUB"],
  });
  // Team: todas las integraciones, 1 proyecto.
  const team = await seedPlanUser({
    email: "team@demo.co",
    name: "Usuario Team",
    wsName: "Team Demo",
    plan: "TEAM",
    types: ["JIRA", "GITHUB", "SLACK", "LINEAR", "GITLAB"],
  });

  // Usuario "recién llegado" para ver el ONBOARDING: workspace + proyecto vacío,
  // sin integraciones ni reportes. NO se le corre seedHistory a propósito.
  const nuevo = await seedPlanUser({
    email: "nuevo@demo.co",
    name: "Usuario Nuevo",
    wsName: "Onboarding Demo",
    plan: "FREE",
    types: [], // sin integraciones conectadas
    role: "PRODUCT_OWNER",
  });
  // limpiar cualquier reporte previo de este usuario (para que quede en estado onboarding)
  await prisma.report.deleteMany({ where: { workspaceId: nuevo.ws.id } });
  // Reverse trial activo (10 días de Pro) para ver el trial + onboarding.
  await prisma.workspace.update({
    where: { id: nuevo.ws.id },
    data: { trialEndsAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000) },
  });

  // Historial de sprints variados en cada plan (Pro con IA en Web App).
  await seedHistory(workspace.id, webApp.id, true);
  await seedHistory(team.ws.id, team.proj.id, false);
  await seedHistory(free.ws.id, free.proj.id, false);

  // --- Features nuevas en el workspace Pro (test@test) para verlas cargadas ---
  const baseStd = {
    thresholds: {
      completionRate: { healthy: 85, risk: 70 },
      bugs: { healthy: 3, risk: 8 },
    },
    weights: { delivery: 30, quality: 25, product: 20, team: 15, risk: 10 },
  };
  const customStd = {
    thresholds: {
      completionRate: { healthy: 80, risk: 65 },
      bugs: { healthy: 2, risk: 5 },
    },
    weights: { delivery: 30, quality: 30, product: 20, team: 10, risk: 10 },
  };

  // Estándar de salud personalizado + historial (editor de Umbrales, diff).
  try {
    await prisma.healthStandard.upsert({
      where: { workspaceId_projectId: { workspaceId: workspace.id, projectId: null } },
      update: { config: customStd, reason: "Ajuste inicial del equipo", updatedById: user.id },
      create: { workspaceId: workspace.id, projectId: null, config: customStd, reason: "Ajuste inicial del equipo", updatedById: user.id },
    });
    await prisma.healthStandardHistory.deleteMany({ where: { workspaceId: workspace.id, projectId: null } });
    await prisma.healthStandardHistory.createMany({
      data: [
        { workspaceId: workspace.id, projectId: null, config: baseStd, reason: "Estándar base", changedById: user.id, changedByName: "Usuario de Prueba" },
        { workspaceId: workspace.id, projectId: null, config: customStd, reason: "Ajuste inicial del equipo", changedById: user.id, changedByName: "Usuario de Prueba" },
      ],
    });
  } catch (e) {
    console.warn("   (standards seed omitido:", e.message, ")");
  }

  // Reglas de alerta personalizadas (Pro).
  try {
    await prisma.alertRule.deleteMany({ where: { workspaceId: workspace.id, projectId: null } });
    await prisma.alertRule.createMany({
      data: [
        { workspaceId: workspace.id, projectId: null, metricKey: "bugs", operator: "gt", threshold: 8, severity: "high", enabled: true, createdById: user.id },
        { workspaceId: workspace.id, projectId: null, metricKey: "completionRate", operator: "lt", threshold: 70, severity: "medium", enabled: true, createdById: user.id },
      ],
    });
  } catch (e) {
    console.warn("   (alert rules seed omitido:", e.message, ")");
  }

  // Compartir un reporte con niveles (Ejecutiva sin datos por persona / Completa).
  try {
    const rep = await prisma.report.findFirst({
      where: { projectId: webApp.id },
      orderBy: { periodEnd: "desc" },
    });
    if (rep) {
      await prisma.reportShare.deleteMany({ where: { reportId: rep.id } });
      await prisma.reportShare.create({
        data: { reportId: rep.id, userId: viewerUser.id, level: "EXECUTIVE" },
      });
      await prisma.reportShare.create({
        data: { reportId: rep.id, userId: teammateIds["Ana"], level: "FULL" },
      });
    }
  } catch (e) {
    console.warn("   (shares seed omitido:", e.message, ")");
  }

  // Registro de auditoría de ejemplo.
  try {
    await prisma.auditLog.deleteMany({ where: { workspaceId: workspace.id } });
    await prisma.auditLog.createMany({
      data: [
        { workspaceId: workspace.id, actorId: user.id, actorName: "Usuario de Prueba", action: "plan.change", target: "PRO", meta: { from: "FREE", to: "PRO" } },
        { workspaceId: workspace.id, actorId: user.id, actorName: "Usuario de Prueba", action: "integration.connect", target: "Jira" },
        { workspaceId: workspace.id, actorId: user.id, actorName: "Usuario de Prueba", action: "report.share", target: "viewer@demo.co", meta: { level: "EXECUTIVE" } },
      ],
    });
  } catch (e) {
    console.warn("   (audit seed omitido:", e.message, ")");
  }

  const P = TEST_PASSWORD;
  console.log("\n✅ Seed completado. Usuarios (todos con contraseña: " + P + ")\n");
  console.log("┌─ QUIÉN VE QUÉ ───────────────────────────────────────────────");
  console.log(`│ ${TEST_EMAIL}  → PRO / Owner`);
  console.log("│    Ve TODO: 2 proyectos, todas las integraciones + IA (Claude demo),");
  console.log("│    umbrales personalizados + historial/diff, reglas de alerta,");
  console.log("│    datos por persona, export CSV+PDF, auditoría, comparativas.");
  console.log("│");
  console.log("│ team@demo.co  → TEAM / Owner");
  console.log("│    1 proyecto, integraciones de tareas y código (sin IA/comunicación),");
  console.log("│    umbrales EDITABLES (workspace), export CSV+PDF, histórico 12m,");
  console.log("│    reportes ilimitados. Sin multi-proyecto, sin reglas de alerta (Pro).");
  console.log("│");
  console.log("│ free@demo.co  → FREE / Owner");
  console.log("│    1 proyecto, solo Jira + GitHub, umbrales SOLO LECTURA, export CSV,");
  console.log("│    histórico 3m, tope 10 reportes/mes. Sin IA/alertas/multi-proyecto.");
  console.log("│");
  console.log("│ nuevo@demo.co → FREE + TRIAL Pro (10 días) / Product Owner");
  console.log("│    Estado ONBOARDING: proyecto vacío, sin integraciones → checklist.");
  console.log("│    Durante el trial ve funciones Pro (banner de días restantes).");
  console.log("│");
  console.log("│ viewer@demo.co → VIEWER en el workspace PRO");
  console.log("│    Solo lectura. SIN datos por persona (403 en /people, banner en");
  console.log("│    el reporte). No edita umbrales/integraciones/plan ni ve auditoría.");
  console.log("│    Tiene un reporte compartido en nivel EJECUTIVO.");
  console.log("│");
  console.log("│ ana/bruno/carla/diego/elena@demo.co → MEMBER (proyectos del Pro)");
  console.log("│    Ven reportes y datos por persona de sus proyectos. Ana tiene un");
  console.log("│    reporte compartido en nivel COMPLETO.");
  console.log("└──────────────────────────────────────────────────────────────");
}

main()
  .catch((e) => {
    console.error("❌ Error en el seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
