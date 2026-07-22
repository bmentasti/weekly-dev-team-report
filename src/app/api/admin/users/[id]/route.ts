import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/admin";
import { parseBody } from "@/lib/api";
import type { UserRole } from "@prisma/client";

const patchSchema = z.object({
  role: z
    .enum([
      "TECH_LEAD",
      "PRODUCT_OWNER",
      "ENGINEERING_MANAGER",
      "CTO",
      "DEVELOPER_LEAD",
      "DEVELOPER",
      "OTHER",
    ])
    .optional(),
});

/** Backoffice: edita el rol funcional de un usuario. */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const guard = await requireSuperAdmin();
  if ("error" in guard) return guard.error;

  const { data, error } = await parseBody(request, patchSchema);
  if (error) return error;
  if (!data.role)
    return NextResponse.json({ error: "Nada para actualizar." }, { status: 400 });

  const updated = await prisma.user
    .update({
      where: { id: params.id },
      data: { role: data.role as UserRole },
      select: { id: true, role: true },
    })
    .catch(() => null);
  if (!updated)
    return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });

  return NextResponse.json({ ok: true, role: updated.role });
}

/**
 * Backoffice: elimina un usuario. Los cascades de Prisma borran también sus
 * workspaces propios (con proyectos, reportes e integraciones), membresías,
 * notas, shares y notificaciones. Protecciones: no podés borrarte a vos mismo
 * ni borrar a otro superadmin (primero quitale el flag en la base).
 */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const guard = await requireSuperAdmin();
  if ("error" in guard) return guard.error;

  if (params.id === guard.userId)
    return NextResponse.json(
      { error: "No podés eliminar tu propia cuenta de admin." },
      { status: 400 },
    );

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target)
    return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
  if ((target as { isSuperAdmin?: boolean }).isSuperAdmin === true)
    return NextResponse.json(
      { error: "No se puede eliminar a otro superadmin." },
      { status: 400 },
    );

  await prisma.user.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
