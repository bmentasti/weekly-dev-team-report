import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ACTIVE_PROJECT_COOKIE, canAccessProject } from "@/lib/project";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { projectId?: string };
  const projectId = body.projectId ?? "";
  if (!projectId || !(await canAccessProject(session.user.id, projectId)))
    return NextResponse.json({ error: "Proyecto inválido." }, { status: 400 });

  cookies().set(ACTIVE_PROJECT_COOKIE, projectId, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });

  return NextResponse.json({ ok: true });
}
