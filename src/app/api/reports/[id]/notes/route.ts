import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getReportAccess,
  notifyUsers,
  reportParticipantUserIds,
} from "@/lib/reports/access";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const access = await getReportAccess(session.user.id, params.id);
  if (!access)
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });

  const notes = await prisma.reportNote.findMany({
    where: { reportId: params.id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ notes, currentUserId: session.user.id });
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const access = await getReportAccess(session.user.id, params.id);
  if (!access)
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as { body?: string };
  const text = (body.body ?? "").trim();
  if (!text)
    return NextResponse.json({ error: "La nota está vacía." }, { status: 400 });

  const note = await prisma.reportNote.create({
    data: {
      reportId: params.id,
      authorId: session.user.id,
      authorName: session.user.name ?? "Usuario",
      body: text,
    },
  });

  // Notify other participants that a note was added.
  const recipients = await reportParticipantUserIds(params.id, session.user.id);
  await notifyUsers(
    recipients,
    "NOTE_ADDED",
    `${session.user.name ?? "Alguien"} dejó una nota en un reporte.`,
    params.id,
  );

  return NextResponse.json({ note }, { status: 201 });
}
