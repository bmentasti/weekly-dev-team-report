import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveWorkspaceForUser } from "@/lib/workspace";
import { listProjectsForUser, resolveActiveProject } from "@/lib/project";
import { PLANS, effectivePlan } from "@/lib/plans";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const projects = await listProjectsForUser(session.user.id);
  const active = await resolveActiveProject(session.user.id);
  return NextResponse.json({
    projects: projects.map((p) => ({ id: p.id, name: p.name })),
    activeId: active?.id ?? null,
  });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { name?: string };
  const name = (body.name ?? "").trim();
  if (name.length < 2)
    return NextResponse.json({ error: "Nombre inválido." }, { status: 400 });

  const workspace = await resolveWorkspaceForUser(session.user.id);
  if (!workspace)
    return NextResponse.json({ error: "No tenés un workspace." }, { status: 400 });

  const plan = effectivePlan(workspace);
  const limit = PLANS[plan].maxProjects;
  if (limit !== null) {
    const count = await prisma.project.count({
      where: { workspaceId: workspace.id },
    });
    if (count >= limit) {
      return NextResponse.json(
        {
          error: `Tu plan (${PLANS[plan].name}) permite ${limit} proyecto(s). Pasá a Pro para proyectos ilimitados.`,
        },
        { status: 403 },
      );
    }
  }

  const project = await prisma.project.create({
    data: {
      workspaceId: workspace.id,
      name,
      members: { create: { userId: session.user.id, role: "OWNER" } },
    },
  });

  return NextResponse.json({ project: { id: project.id, name: project.name } }, {
    status: 201,
  });
}
