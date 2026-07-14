import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encryption";
import { resolveActiveProject } from "@/lib/project";
import { getProvider } from "@/lib/integrations/catalog";
import { integrationAllowed, PLANS, effectivePlan } from "@/lib/plans";
import { logAudit } from "@/lib/audit";
import { getAdapter } from "@/lib/integrations/registry";
import { parseConnectionBody } from "@/lib/integrations/connect-helpers";
import type { IntegrationType } from "@prisma/client";

export async function POST(
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

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { config, secret, missing } = parseConnectionBody(entry, body);

  const project = await resolveActiveProject(session.user.id);
  if (!project) {
    return NextResponse.json(
      { error: "No tenés un proyecto. Creá uno primero." },
      { status: 400 },
    );
  }

  const type = entry.type as IntegrationType;

  // Al EDITAR una conexión ya existente, el token no se reingresa: si el campo
  // secreto vino vacío pero hay un token guardado, se reutiliza el almacenado
  // (cifrado). Solo se pide de nuevo al conectar por primera vez o al elegir
  // "Reemplazar token".
  const existing = await prisma.integration.findUnique({
    where: { projectId_type: { projectId: project.id, type } },
  });
  const secretLabel = entry.fields.find(
    (f) => f.name === entry.secretField,
  )?.label;

  let effectiveSecret = secret;
  let keepStoredToken = false;
  if (!secret && existing?.encryptedAccessToken) {
    try {
      effectiveSecret = decrypt(existing.encryptedAccessToken);
      keepStoredToken = true;
    } catch {
      // token guardado ilegible: se exigirá reingresarlo (queda en `missing`).
    }
  }

  const missingFinal = keepStoredToken
    ? missing.filter((m) => m !== secretLabel)
    : missing;
  if (missingFinal.length > 0) {
    return NextResponse.json(
      { ok: false, error: `Faltan campos: ${missingFinal.join(", ")}` },
      { status: 200 },
    );
  }

  // Mapeo de columnas confirmado por el usuario (opcional): se persiste en la
  // config para que el adapter lo use al sincronizar.
  if (body.fieldMap && typeof body.fieldMap === "object") {
    config.fieldMap = JSON.stringify(body.fieldMap);
  } else if (existing?.config && (existing.config as Record<string, unknown>).fieldMap) {
    // Preservar el mapeo previo si esta edición no lo reenvía.
    config.fieldMap = String(
      (existing.config as Record<string, unknown>).fieldMap,
    );
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: project.workspaceId },
  });
  const plan = effectivePlan(workspace);
  if (!integrationAllowed(plan, entry.type)) {
    return NextResponse.json(
      {
        ok: false,
        error: `Tu plan (${PLANS[plan].name}) no incluye ${entry.label}. Pasá a Team o Pro para todas las integraciones.`,
      },
      { status: 200 },
    );
  }

  // Validate before persisting so we never store a broken integration.
  const test = await adapter.testConnection({ config, secret: effectiveSecret });
  if (!test.ok) {
    return NextResponse.json({ ok: false, error: test.error }, { status: 200 });
  }

  await prisma.integration.upsert({
    where: { projectId_type: { projectId: project.id, type } },
    update: {
      status: "CONNECTED",
      config,
      // Solo se reescribe el token si el usuario ingresó uno nuevo.
      ...(keepStoredToken ? {} : { encryptedAccessToken: encrypt(secret) }),
    },
    create: {
      workspaceId: project.workspaceId,
      projectId: project.id,
      type,
      status: "CONNECTED",
      config,
      encryptedAccessToken: encrypt(effectiveSecret),
    },
  });

  await logAudit({
    workspaceId: project.workspaceId,
    actorId: session.user.id,
    actorName: session.user.name,
    action: "integration.connect",
    target: entry.label,
  });

  return NextResponse.json({ ok: true, detail: test.detail });
}
