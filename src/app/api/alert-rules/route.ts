import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveWorkspaceForUser } from "@/lib/workspace";
import { parseBody } from "@/lib/api";
import { alertRuleSchema } from "@/lib/validations";
import { METRIC_DEFS } from "@/lib/reports/standards";
import { alertRuleModel } from "@/lib/reports/health-standard-model";
import { effectivePlan, type PlanTierName } from "@/lib/plans";

const NOT_MIGRATED =
  "La tabla de reglas de alerta no está en la base. Ejecutá `npm run db:push` y reiniciá el server.";

/** Las reglas de alerta personalizadas son parte del plan Pro. */
function canUseRules(plan: PlanTierName) {
  return plan === "PRO";
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const workspace = await resolveWorkspaceForUser(session.user.id);
  if (!workspace)
    return NextResponse.json({ plan: "FREE", rules: [], persistenceReady: true });

  const plan = effectivePlan(workspace);
  const model = alertRuleModel();
  let rules: unknown[] = [];
  let persistenceReady = !!model;
  if (model) {
    try {
      rules = await model.findMany({
        where: { workspaceId: workspace.id, projectId: null },
        orderBy: { createdAt: "desc" },
      });
    } catch {
      persistenceReady = false;
    }
  }
  return NextResponse.json({ plan, rules, persistenceReady });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const workspace = await resolveWorkspaceForUser(session.user.id);
  if (!workspace)
    return NextResponse.json({ error: "Sin workspace." }, { status: 400 });
  if (!canUseRules(effectivePlan(workspace)))
    return NextResponse.json(
      { error: "Las reglas de alerta personalizadas están en el plan Pro." },
      { status: 403 },
    );

  const { data, error } = await parseBody(request, alertRuleSchema);
  if (error) return error;

  if (!METRIC_DEFS.some((d) => d.key === data.metricKey))
    return NextResponse.json({ error: "Métrica inválida." }, { status: 422 });

  const model = alertRuleModel();
  if (!model) return NextResponse.json({ error: NOT_MIGRATED }, { status: 503 });
  try {
    const rule = await model.create({
      data: {
        workspaceId: workspace.id,
        projectId: null,
        metricKey: data.metricKey,
        operator: data.operator,
        threshold: data.threshold,
        severity: data.severity,
        enabled: true,
        createdById: session.user.id,
      },
    });
    return NextResponse.json({ ok: true, rule });
  } catch {
    return NextResponse.json({ error: NOT_MIGRATED }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta id." }, { status: 400 });

  const workspace = await resolveWorkspaceForUser(session.user.id);
  if (!workspace)
    return NextResponse.json({ error: "Sin workspace." }, { status: 400 });

  const model = alertRuleModel();
  if (model) {
    try {
      // scope por workspace: no se puede borrar reglas de otro workspace
      await model.deleteMany({ where: { id, workspaceId: workspace.id } });
    } catch {
      // sin tabla => nada que borrar
    }
  }
  return NextResponse.json({ ok: true });
}
