import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getReportAccess } from "@/lib/reports/access";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; noteId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const access = await getReportAccess(session.user.id, params.id);
  if (!access)
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });

  const note = await prisma.reportNote.findUnique({
    where: { id: params.noteId },
  });
  if (!note || note.reportId !== params.id)
    return NextResponse.json({ error: "Nota no encontrada." }, { status: 404 });
  if (note.authorId !== session.user.id)
    return NextResponse.json(
      { error: "Solo el autor puede editar la nota." },
      { status: 403 },
    );

  const body = (await request.json().catch(() => ({}))) as { body?: string };
  const text = (body.body ?? "").trim();
  if (!text)
    return NextResponse.json({ error: "La nota está vacía." }, { status: 400 });

  const updated = await prisma.reportNote.update({
    where: { id: params.noteId },
    data: { body: text },
  });
  return NextResponse.json({ note: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; noteId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const note = await prisma.reportNote.findUnique({
    where: { id: params.noteId },
  });
  if (!note || note.reportId !== params.id)
    return NextResponse.json({ error: "Nota no encontrada." }, { status: 404 });
  if (note.authorId !== session.user.id)
    return NextResponse.json(
      { error: "Solo el autor puede eliminar la nota." },
      { status: 403 },
    );

  await prisma.reportNote.delete({ where: { id: params.noteId } });
  return NextResponse.json({ ok: true });
}
