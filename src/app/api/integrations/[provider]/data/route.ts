import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveActiveProject } from "@/lib/project";
import { getProvider } from "@/lib/integrations/catalog";
import { getAdapter } from "@/lib/integrations/registry";
import { loadConnectionContext } from "@/lib/integrations/loader";
import {
  classifySyncError,
  classifySyncSuccess,
  summarizeData,
} from "@/lib/integrations/health";
import {
  recordSyncSuccess,
  recordSyncFailure,
} from "@/lib/integrations/sync-store";
import { getIdentityConfig } from "@/lib/reports/identity-store";
import { makeResolver } from "@/lib/reports/identity";
import { computeAssociationStats } from "@/lib/reports/association-stats";
import type { IntegrationType } from "@prisma/client";

export async function GET(
  request: Request,
  { params }: { params: { provider: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const entry = getProvider(params.provider);
  const adapter = getAdapter(params.provider);
  if (!entry || !entry.enabled || !adapter) {
    return NextResponse.json(
      { error: "Integración no disponible." },
      { status: 404 },
    );
  }

  const project = await resolveActiveProject(session.user.id);
  if (!project) {
    return NextResponse.json({ error: "No tenés un proyecto." }, { status: 400 });
  }

  const loaded = await loadConnectionContext(
    project.id,
    entry.type as IntegrationType,
  );
  if (!loaded) {
    return NextResponse.json(
      { error: `${entry.label} no está conectado en este workspace.` },
      { status: 400 },
    );
  }

  const { searchParams } = new URL(request.url);
  const since = searchParams.get("since") ?? undefined;

  try {
    const data = await adapter.fetchData(loaded.ctx, { since });
    // Salud REAL: no basta con que la auth funcione; medimos qué se pudo traer.
    const summary = summarizeData(data);
    const cls = classifySyncSuccess(summary, entry.label);

    // Asociación: participantes vinculados, actividad sin persona e identidades
    // pendientes de confirmar (sugerencias sin verificar del proyecto).
    const config = await getIdentityConfig(project.id);
    const stats = computeAssociationStats(data, makeResolver(config));
    const pendingIdentities = config.aliases.filter((a) => a.verified === false).length;

    await recordSyncSuccess(loaded.integrationId, cls, summary, {
      participantsLinked: stats.participantsLinked,
      unassociatedRecords: stats.unassociatedRecords,
      pendingIdentities,
    });
    return NextResponse.json({
      data,
      health: {
        status: cls.status,
        ...summary,
        participantsLinked: stats.participantsLinked,
        unassociatedRecords: stats.unassociatedRecords,
        pendingIdentities,
      },
    });
  } catch (err) {
    // Clasifica el fallo en un estado accionable (token vencido, permisos,
    // rate limit, etc.) con mensaje comprensible + acción recomendada.
    const cls = classifySyncError(err, entry.label);
    await recordSyncFailure(loaded.integrationId, cls);
    return NextResponse.json(
      {
        error: cls.lastErrorMessage,
        status: cls.status,
        recommendedAction: cls.recommendedAction,
        missingPermissions: cls.missingPermissions,
      },
      { status: cls.status === "RATE_LIMITED" ? 429 : 502 },
    );
  }
}
