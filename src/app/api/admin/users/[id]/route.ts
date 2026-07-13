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
