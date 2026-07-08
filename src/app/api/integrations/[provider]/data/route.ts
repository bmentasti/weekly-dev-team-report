import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveActiveProject } from "@/lib/project";
import { getProvider } from "@/lib/integrations/catalog";
import { getAdapter } from "@/lib/integrations/registry";
import { loadConnectionContext } from "@/lib/integrations/loader";
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
    return NextResponse.json({ data });
  } catch (err) {
    await prisma.integration.update({
      where: { id: loaded.integrationId },
      data: { status: "ERROR" },
    });
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : `Error al consultar ${entry.label}.`,
      },
      { status: 502 },
    );
  }
}
