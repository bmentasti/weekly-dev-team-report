import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { resolveActiveProject } from "@/lib/project";
import { describeTable } from "@/lib/integrations/airtable/schema";

/**
 * POST /api/integrations/airtable/schema
 * Body: { baseId, tableName, apiToken? }
 *
 * Devuelve las columnas reales de la tabla (tipo, muestras, completitud) y el
 * mapeo sugerido. Si no se envía apiToken, usa el token guardado de la conexión
 * Airtable del proyecto activo (nunca se devuelve el token al cliente).
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: { baseId?: string; tableName?: string; apiToken?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const baseId = (body.baseId ?? "").trim();
  const tableName = (body.tableName ?? "").trim();
  if (!baseId || !tableName) {
    return NextResponse.json(
      { ok: false, error: "Indicá el Base ID y el nombre de la tabla." },
      { status: 200 },
    );
  }

  // Token: el enviado (al conectar por primera vez) o el guardado (al editar).
  let token = (body.apiToken ?? "").trim();
  if (!token) {
    const project = await resolveActiveProject(session.user.id);
    if (project) {
      const integration = await prisma.integration.findUnique({
        where: { projectId_type: { projectId: project.id, type: "AIRTABLE" } },
      });
      if (integration?.encryptedAccessToken) {
        try {
          token = decrypt(integration.encryptedAccessToken);
        } catch {
          // token guardado ilegible: se pedirá reingresarlo.
        }
      }
    }
  }
  if (!token) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "No hay un token disponible. Ingresá el Personal Access Token para detectar las columnas.",
      },
      { status: 200 },
    );
  }

  try {
    const description = await describeTable(baseId, tableName, token);
    return NextResponse.json({ ok: true, ...description });
  } catch (err) {
    const status = (err as { status?: number }).status;
    const message =
      status === 401
        ? "Token inválido o sin permisos."
        : status === 403
          ? "El token no tiene acceso a esta base."
          : status === 404
            ? `No se encontró la tabla "${tableName}" en la base.`
            : err instanceof Error
              ? err.message
              : "Error al leer la estructura de la tabla.";
    return NextResponse.json({ ok: false, error: message }, { status: 200 });
  }
}
