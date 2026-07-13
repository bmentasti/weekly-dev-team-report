import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getReportAccess } from "@/lib/reports/access";
import { resolveWorkspaceRole } from "@/lib/workspace";
import { can } from "@/lib/permissions";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; shareId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const access = await getReportAccess(session.user.id, params.id);
  if (!access) return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  // Revocar un share es administrar el reporte: sólo miembros del workspace con
  // capability shareReports (no un invitado externo). (SEC-02)
  const role = access.isWorkspaceMember
    ? await resolveWorkspaceRole(session.user.id, access.workspaceId)
    : null;
  if (!can(role, "shareReports"))
    return NextResponse.json(
      { error: "No podés modificar los accesos de este reporte." },
      { status: 403 },
    );

  const deleted = await prisma.reportShare.deleteMany({
    where: { id: params.shareId, reportId: params.id },
  });
  if (deleted.count === 0)
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });

  return NextResponse.json({ ok: true });
}
