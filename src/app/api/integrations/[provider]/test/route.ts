import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { resolveActiveProject } from "@/lib/project";
import { getProvider } from "@/lib/integrations/catalog";
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

  // Permite validar una conexión existente SIN reingresar el token: si el
  // campo secreto vino vacío pero hay un token guardado, se usa el almacenado.
  let effectiveSecret = secret;
  let keepStoredToken = false;
  if (!secret) {
    const project = await resolveActiveProject(session.user.id);
    if (project) {
      const existing = await prisma.integration.findUnique({
        where: {
          projectId_type: {
            projectId: project.id,
            type: entry.type as IntegrationType,
          },
        },
      });
      if (existing?.encryptedAccessToken) {
        try {
          effectiveSecret = decrypt(existing.encryptedAccessToken);
          keepStoredToken = true;
        } catch {
          // token ilegible: se pedirá reingresarlo.
        }
      }
    }
  }

  const secretLabel = entry.fields.find(
    (f) => f.name === entry.secretField,
  )?.label;
  const missingFinal = keepStoredToken
    ? missing.filter((m) => m !== secretLabel)
    : missing;
  if (missingFinal.length > 0) {
    return NextResponse.json(
      { ok: false, error: `Faltan campos: ${missingFinal.join(", ")}` },
      { status: 200 },
    );
  }

  const result = await adapter.testConnection({ config, secret: effectiveSecret });
  return NextResponse.json(result);
}
