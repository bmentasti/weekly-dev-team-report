import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Guard del backoffice. Verifica sesión + flag isSuperAdmin CONTRA LA BASE
 * (no confía solo en el JWT: si se revoca el flag, pierde acceso al instante).
 * Devuelve el userId del admin o una NextResponse de error lista para retornar.
 */
export async function requireSuperAdmin(): Promise<
  { userId: string; name: string | null } | { error: NextResponse }
> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return {
      error: NextResponse.json({ error: "No autorizado" }, { status: 401 }),
    };
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  const isSuper =
    (user as { isSuperAdmin?: boolean } | null)?.isSuperAdmin === true;
  if (!isSuper) {
    return {
      error: NextResponse.json(
        { error: "Requiere permisos de administrador." },
        { status: 403 },
      ),
    };
  }
  return { userId: session.user.id, name: session.user.name ?? null };
}
