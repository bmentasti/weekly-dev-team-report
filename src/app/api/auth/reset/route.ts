import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { parseBody, rateLimit } from "@/lib/api";

const schema = z.object({
  token: z.string().min(20),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

/** Aplica el reset: valida el token (hash, vigencia, un solo uso) y cambia la contraseña. */
export async function POST(request: Request) {
  const xff = request.headers.get("x-forwarded-for") ?? "unknown";
  const ip = xff.split(",")[0]?.trim() || "unknown";
  if (!rateLimit(`reset:${ip}`, { limit: 10, windowMs: 60_000 }).ok) {
    return NextResponse.json({ error: "Demasiados intentos." }, { status: 429 });
  }

  const { data, error } = await parseBody(request, schema);
  if (error) return error;

  const tokenHash = crypto
    .createHash("sha256")
    .update(data.token)
    .digest("hex");
  const reset = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });
  if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "El enlace es inválido o venció. Pedí uno nuevo." },
      { status: 400 },
    );
  }

  const passwordHash = await bcrypt.hash(data.password, 12);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: reset.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: reset.id },
      data: { usedAt: new Date() },
    }),
    // Invalida cualquier otro token pendiente del mismo usuario.
    prisma.passwordResetToken.deleteMany({
      where: { userId: reset.userId, usedAt: null, id: { not: reset.id } },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
