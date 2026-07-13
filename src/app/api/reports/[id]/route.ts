import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveWorkspaceForUser } from "@/lib/workspace";
import { getReportAccess, redactReportForAccess } from "@/lib/reports/access";
import { resolveWorkspaceRole } from "@/lib/workspace";
import { can } from "@/lib/permissions";
import { parseBody } from "@/lib/api";
import { reportPatchSchema } from "@/lib/validations";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const access = await getReportAccess(session.user.id, params.id);
  if (!access) {
    return NextResponse.json({ error: "Sin acceso al reporte." }, { status: 403 });
  }

  // Mark as viewed if this user was shared the report.
  if (access.shareId) {
    await prisma.reportShare.update({
      where: { id: access.shareId },
      data: { viewedAt: new Date() },
    });
  }

  const report = await prisma.report.findUnique({ where: { id: params.id } });
  if (!report) {
    return NextResponse.json({ error: "Reporte no encontrado." }, { status: 404 });
  }

  // Datos por persona ocultos según rol / nivel de share (RBAC). (SEC-07)
  const out = redactReportForAccess(report, access);

  return NextResponse.json({
    report: out,
    access: { canViewPeople: access.canViewPeople, level: access.level },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const access = await getReportAccess(session.user.id, params.id);
  if (!access)
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });

  // Editar (fijar/tags/revisado) requiere la capability editReport.
  const role = access.isWorkspaceMember
    ? await resolveWorkspaceRole(session.user.id, access.workspaceId)
    : null;
  if (!can(role, "editReport"))
    return NextResponse.json(
      { error: "Tu rol no permite editar reportes." },
      { status: 403 },
    );

  const { data: body, error: parseErr } = await parseBody(
    request,
    reportPatchSchema,
  );
  if (parseErr) return parseErr;
  const data: Record<string, unknown> = {};
  if (typeof body.pinned === "boolean") data.pinned = body.pinned;
  if (typeof body.reviewed === "boolean")
    data.reviewedAt = body.reviewed ? new Date() : null;
  if (Array.isArray(body.tags))
    data.tags = body.tags.map((t) => t.trim()).filter(Boolean);

  const updated = await prisma.report.updateMany({
    where: { id: params.id, workspaceId: access.workspaceId },
    data,
  });
  if (updated.count === 0)
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const workspace = await resolveWorkspaceForUser(session.user.id);
  if (!workspace) {
    return NextResponse.json({ error: "No tenés un workspace." }, { status: 400 });
  }

  // Ensure the report belongs to the user's workspace before deleting.
  const deleted = await prisma.report.deleteMany({
    where: { id: params.id, workspaceId: workspace.id },
  });

  if (deleted.count === 0) {
    return NextResponse.json({ error: "Reporte no encontrado." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
