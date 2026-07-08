import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createWorkspaceSchema } from "@/lib/validations";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const workspaces = await prisma.workspace.findMany({
    where: {
      OR: [
        { ownerId: session.user.id },
        { members: { some: { userId: session.user.id } } },
      ],
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ workspaces });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = createWorkspaceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  // Reverse trial: 14 días de Pro para toda cuenta nueva.
  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  // data extraído a variable: evita el chequeo de exceso hasta regenerar el
  // cliente Prisma con el campo trialEndsAt (npm run db:push).
  const createData = {
    ...parsed.data,
    ownerId: session.user.id,
    trialEndsAt,
    members: {
      create: { userId: session.user.id, role: "OWNER" as const },
    },
    projects: {
      create: {
        name: "General",
        members: { create: { userId: session.user.id, role: "OWNER" as const } },
      },
    },
  };
  const workspace = await prisma.workspace.create({ data: createData });

  return NextResponse.json({ workspace }, { status: 201 });
}
