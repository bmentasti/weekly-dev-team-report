import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveWorkspaceForUser, resolveWorkspaceRole } from "@/lib/workspace";
import { can, ROLE_LABEL, type AccessRole } from "@/lib/permissions";
import { parseBody } from "@/lib/api";
import { memberInviteSchema, memberRoleSchema } from "@/lib/validations";
import { PLANS, effectivePlan } from "@/lib/plans";
import { logAudit } from "@/lib/audit";
import type { WorkspaceRole } from "@prisma/client";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const workspace = await resolveWorkspaceForUser(session.user.id);
  if (!workspace) return NextResponse.json({ members: [], myRole: null });

  const myRole = await resolveWorkspaceRole(session.user.id, workspace.id);
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId: workspace.id },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    myRole,
    canManage: can(myRole, "manageRoles"),
    canInvite: can(myRole, "inviteUsers"),
    ownerId: workspace.ownerId,
    members: members.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      roleLabel: ROLE_LABEL[m.role as AccessRole] ?? m.role,
      isOwner: m.user.id === workspace.ownerId,
    })),
  });
}

// Invitar (agregar) un usuario existente al workspace.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const workspace = await resolveWorkspaceForUser(session.user.id);
  if (!workspace)
    return NextResponse.json({ error: "Sin workspace." }, { status: 400 });

  const myRole = await resolveWorkspaceRole(session.user.id, workspace.id);
  if (!can(myRole, "inviteUsers"))
    return NextResponse.json(
      { error: "No tenés permiso para invitar miembros." },
      { status: 403 },
    );

  const { data, error } = await parseBody(request, memberInviteSchema);
  if (error) return error;

  // Límite de usuarios por plan (efectivo).
  const max = PLANS[effectivePlan(workspace)].maxMembers;
  if (max !== null) {
    const count = await prisma.workspaceMember.count({
      where: { workspaceId: workspace.id },
    });
    if (count >= max)
      return NextResponse.json(
        {
          error: `Tu plan permite ${max} usuarios. Pasá a un plan mayor para sumar más.`,
          requiresUpgrade: true,
        },
        { status: 402 },
      );
  }

  const email = data.email.trim().toLowerCase();
  const target = await prisma.user.findUnique({ where: { email } });
  if (!target)
    return NextResponse.json(
      {
        error:
          "Ese email todavía no tiene cuenta en DevMetrics. Pedile que se registre y volvé a invitarlo.",
      },
      { status: 404 },
    );

  const existing = await prisma.workspaceMember.findFirst({
    where: { workspaceId: workspace.id, userId: target.id },
  });
  if (existing)
    return NextResponse.json({ error: "Ya es miembro." }, { status: 409 });

  await prisma.workspaceMember.create({
    data: {
      workspaceId: workspace.id,
      userId: target.id,
      role: data.role as WorkspaceRole,
    },
  });
  await logAudit({
    workspaceId: workspace.id,
    actorId: session.user.id,
    actorName: session.user.name,
    action: "member.invite",
    target: email,
    meta: { role: data.role },
  });

  return NextResponse.json({ ok: true });
}

// Cambiar el rol de un miembro.
export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const workspace = await resolveWorkspaceForUser(session.user.id);
  if (!workspace)
    return NextResponse.json({ error: "Sin workspace." }, { status: 400 });

  const myRole = await resolveWorkspaceRole(session.user.id, workspace.id);
  if (!can(myRole, "manageRoles"))
    return NextResponse.json(
      { error: "No tenés permiso para cambiar roles." },
      { status: 403 },
    );

  const { data, error } = await parseBody(request, memberRoleSchema);
  if (error) return error;

  if (data.userId === workspace.ownerId)
    return NextResponse.json(
      { error: "No se puede cambiar el rol del dueño del workspace." },
      { status: 400 },
    );

  const updated = await prisma.workspaceMember.updateMany({
    where: { workspaceId: workspace.id, userId: data.userId },
    data: { role: data.role as WorkspaceRole },
  });
  if (updated.count === 0)
    return NextResponse.json({ error: "Miembro no encontrado." }, { status: 404 });

  await logAudit({
    workspaceId: workspace.id,
    actorId: session.user.id,
    actorName: session.user.name,
    action: "member.role",
    target: data.userId,
    meta: { role: data.role },
  });

  return NextResponse.json({ ok: true });
}

// Quitar un miembro del workspace.
export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const userId = new URL(request.url).searchParams.get("userId");
  if (!userId)
    return NextResponse.json({ error: "Falta userId." }, { status: 400 });

  const workspace = await resolveWorkspaceForUser(session.user.id);
  if (!workspace)
    return NextResponse.json({ error: "Sin workspace." }, { status: 400 });

  const myRole = await resolveWorkspaceRole(session.user.id, workspace.id);
  if (!can(myRole, "manageRoles"))
    return NextResponse.json(
      { error: "No tenés permiso para quitar miembros." },
      { status: 403 },
    );

  if (userId === workspace.ownerId)
    return NextResponse.json(
      { error: "No se puede quitar al dueño del workspace." },
      { status: 400 },
    );

  await prisma.workspaceMember.deleteMany({
    where: { workspaceId: workspace.id, userId },
  });
  await logAudit({
    workspaceId: workspace.id,
    actorId: session.user.id,
    actorName: session.user.name,
    action: "member.remove",
    target: userId,
  });

  return NextResponse.json({ ok: true });
}
