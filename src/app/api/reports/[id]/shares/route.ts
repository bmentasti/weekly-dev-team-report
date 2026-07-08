import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getReportAccess, notifyUsers } from "@/lib/reports/access";
import { logAudit } from "@/lib/audit";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const access = await getReportAccess(session.user.id, params.id);
  if (!access) return NextResponse.json({ error: "Sin acceso" }, { status: 403 });

  const shares = await prisma.reportShare.findMany({
    where: { reportId: params.id },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { name: true, email: true } } },
  });

  const result = shares.map((s) => ({
    id: s.id,
    name: s.user?.name ?? null,
    email: s.user?.email ?? s.inviteEmail,
    pending: !s.userId,
    viewedAt: s.viewedAt,
    level: s.level,
  }));

  return NextResponse.json({ shares: result });
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const access = await getReportAccess(session.user.id, params.id);
  if (!access) return NextResponse.json({ error: "Sin acceso" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as {
    userId?: string;
    email?: string;
    level?: string;
  };
  const level = body.level === "EXECUTIVE" ? "EXECUTIVE" : "FULL";

  let userId: string | null = body.userId ?? null;
  let inviteEmail: string | null = null;

  if (!userId && body.email) {
    const email = body.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      return NextResponse.json({ error: "Email inválido." }, { status: 400 });
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) userId = existing.id;
    else inviteEmail = email;
  }

  if (!userId && !inviteEmail)
    return NextResponse.json(
      { error: "Indicá un miembro o un email." },
      { status: 400 },
    );

  // Avoid duplicates.
  const dupe = await prisma.reportShare.findFirst({
    where: {
      reportId: params.id,
      ...(userId ? { userId } : { inviteEmail }),
    },
  });
  if (dupe)
    return NextResponse.json({ error: "Ya está compartido." }, { status: 409 });

  await prisma.reportShare.create({
    data: { reportId: params.id, userId, inviteEmail, level },
  });

  await logAudit({
    workspaceId: access.workspaceId,
    actorId: session.user.id,
    actorName: session.user.name,
    action: "report.share",
    target: inviteEmail ?? body.userId ?? "miembro",
    meta: { level },
  });

  if (userId) {
    await notifyUsers(
      [userId],
      "REPORT_SHARED",
      `${session.user.name ?? "Alguien"} te compartió un reporte.`,
      params.id,
    );
  }

  return NextResponse.json({ ok: true, pending: !userId });
}
