import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveWorkspaceForUser } from "@/lib/workspace";
import { resolveActiveProject, canAccessProject } from "@/lib/project";
import { parseBody } from "@/lib/api";
import { standardConfigSchema } from "@/lib/validations";
import {
  DEFAULT_STANDARD,
  mergeStandard,
  thresholdValid,
  weightsBalanced,
  METRIC_DEFS,
  type HealthStandardConfig,
} from "@/lib/reports/standards";
import { getEffectiveStandard } from "@/lib/reports/standards-server";
import {
  healthStandardModel,
  healthStandardHistoryModel,
} from "@/lib/reports/health-standard-model";
import { effectivePlan, type PlanTierName } from "@/lib/plans";

const NOT_MIGRATED =
  "La base de datos aún no tiene la tabla de estándares. Ejecutá `npm run db:push` y reiniciá el server.";

/** Free no edita. Proyecto requiere Pro; workspace requiere Team/Pro. */
function canEditScope(plan: PlanTierName, scope: "workspace" | "project") {
  if (scope === "project") return plan === "PRO";
  return plan === "TEAM" || plan === "PRO";
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const url = new URL(request.url);
  const explicitProjectId = url.searchParams.get("projectId");
  const scope =
    url.searchParams.get("scope") === "project" || explicitProjectId
      ? "project"
      : "workspace";

  const workspace = await resolveWorkspaceForUser(session.user.id);
  if (!workspace)
    return NextResponse.json({
      plan: "FREE",
      scope,
      custom: false,
      standard: DEFAULT_STANDARD,
      persistenceReady: true,
      history: [],
      projectName: null,
    });

  const plan = effectivePlan(workspace);
  // Si se pasa projectId explícito (ej. drawer del reporte), usar ese proyecto
  // validando acceso; si no, el proyecto activo cuando el scope es "project".
  let project: { id: string; name: string | null } | null = null;
  if (explicitProjectId) {
    if (await canAccessProject(session.user.id, explicitProjectId)) {
      project = { id: explicitProjectId, name: null };
    }
  } else if (scope === "project") {
    const active = await resolveActiveProject(session.user.id);
    project = active ? { id: active.id, name: active.name } : null;
  }
  const projectId = project?.id ?? null;

  const hs = healthStandardModel();
  const hist = healthStandardHistoryModel();
  let customAtScope = false;
  let persistenceReady = !!hs;
  let history: {
    id: string;
    reason: string | null;
    changedByName: string | null;
    createdAt: Date;
    config: HealthStandardConfig;
  }[] = [];

  if (hs) {
    try {
      const row = await hs.findFirst({
        where: { workspaceId: workspace.id, projectId },
      });
      customAtScope = !!row?.config;
      if (hist) {
        const rows = await hist.findMany({
          where: { workspaceId: workspace.id, projectId },
          orderBy: { createdAt: "desc" },
          take: 10,
        });
        history = rows.map((r) => ({
          id: r.id,
          reason: r.reason,
          changedByName: r.changedByName,
          createdAt: r.createdAt,
          config: mergeStandard(r.config),
        }));
      }
    } catch {
      persistenceReady = false;
    }
  }

  // Estándar efectivo (con herencia si es scope proyecto).
  const standard = await getEffectiveStandard(workspace.id, projectId);

  return NextResponse.json({
    plan,
    scope,
    custom: customAtScope,
    standard,
    persistenceReady,
    history,
    projectName: project?.name ?? null,
    // estándar del workspace, para mostrar "heredado" en scope proyecto
    workspaceStandard:
      scope === "project"
        ? await getEffectiveStandard(workspace.id, null)
        : undefined,
  });
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data, error } = await parseBody(request, standardConfigSchema);
  if (error) return error;
  const scope = data.scope;

  const workspace = await resolveWorkspaceForUser(session.user.id);
  if (!workspace)
    return NextResponse.json({ error: "Sin workspace." }, { status: 400 });

  const plan = effectivePlan(workspace);
  if (!canEditScope(plan, scope))
    return NextResponse.json(
      {
        error:
          scope === "project"
            ? "Los estándares por proyecto están disponibles en el plan Pro."
            : "La personalización está disponible en los planes Team y Pro.",
      },
      { status: 403 },
    );

  const project =
    scope === "project" ? await resolveActiveProject(session.user.id) : null;
  if (scope === "project" && !project)
    return NextResponse.json({ error: "No tenés un proyecto activo." }, { status: 400 });
  const projectId = project?.id ?? null;

  const merged = mergeStandard(data.config as Partial<HealthStandardConfig>);

  if (!weightsBalanced(merged.weights))
    return NextResponse.json(
      { error: "Los pesos del score deben sumar 100%." },
      { status: 422 },
    );
  for (const def of METRIC_DEFS) {
    if (!thresholdValid(def, merged.thresholds[def.key]))
      return NextResponse.json(
        { error: `Umbral inconsistente en “${def.label}”.` },
        { status: 422 },
      );
  }

  const hs = healthStandardModel();
  if (!hs) return NextResponse.json({ error: NOT_MIGRATED }, { status: 503 });
  try {
    await hs.upsert({
      where: {
        workspaceId_projectId: { workspaceId: workspace.id, projectId },
      },
      update: { config: merged, reason: data.reason ?? null, updatedById: session.user.id },
      create: {
        workspaceId: workspace.id,
        projectId,
        config: merged,
        reason: data.reason ?? null,
        updatedById: session.user.id,
      },
    });
    // Registrar en historial (best-effort).
    const hist = healthStandardHistoryModel();
    if (hist) {
      await hist.create({
        data: {
          workspaceId: workspace.id,
          projectId,
          config: merged,
          reason: data.reason ?? null,
          changedById: session.user.id,
          changedByName: session.user.name ?? null,
        },
      });
    }
  } catch {
    return NextResponse.json({ error: NOT_MIGRATED }, { status: 503 });
  }

  return NextResponse.json({ ok: true, standard: merged, custom: true });
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const scope =
    new URL(request.url).searchParams.get("scope") === "project"
      ? "project"
      : "workspace";

  const workspace = await resolveWorkspaceForUser(session.user.id);
  if (!workspace)
    return NextResponse.json({ error: "Sin workspace." }, { status: 400 });

  const project =
    scope === "project" ? await resolveActiveProject(session.user.id) : null;
  const projectId = project?.id ?? null;

  const hs = healthStandardModel();
  if (hs) {
    try {
      await hs.deleteMany({ where: { workspaceId: workspace.id, projectId } });
    } catch {
      // sin tabla => ya está en defaults/herencia
    }
  }

  const standard = await getEffectiveStandard(workspace.id, projectId);
  return NextResponse.json({ ok: true, standard, custom: false });
}
