import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseBody, rateLimit } from "@/lib/api";
import { sendEmail } from "@/lib/reports/email";

const schema = z.object({ email: z.string().email() });

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora

/**
 * Solicita el reset de contraseña. SIEMPRE responde ok (aunque el email no
 * exista) para no revelar qué cuentas están registradas. El token viaja por
 * email; en la base solo se guarda su hash SHA-256, de un solo uso.
 */
export async function POST(request: Request) {
  // Rate limit por IP: evita usar este endpoint para spamear/enumerar.
  const xff = request.headers.get("x-forwarded-for") ?? "unknown";
  const ip = xff.split(",")[0]?.trim() || "unknown";
  if (!rateLimit(`forgot:${ip}`, { limit: 5, windowMs: 60_000 }).ok) {
    return NextResponse.json({ ok: true }); // misma respuesta, sin señal
  }

  const { data, error } = await parseBody(request, schema);
  if (error) return error;

  const user = await prisma.user.findUnique({
    where: { email: data.email.toLowerCase() },
  });

  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      },
    });

    const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const link = `${appUrl}/reset-password?token=${token}`;
    const result = await sendEmail({
      to: [user.email],
      subject: "Restablecé tu contraseña de DevMetrics",
      html: `
        <div style="font-family:sans-serif;max-width:480px">
          <h2>Restablecer contraseña</h2>
          <p>Hola ${user.name}, pediste restablecer tu contraseña.</p>
          <p><a href="${link}" style="display:inline-block;background:#2563FF;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Elegir nueva contraseña</a></p>
          <p style="color:#64748b;font-size:13px">El enlace vence en 1 hora y sirve una sola vez. Si no fuiste vos, ignorá este email.</p>
        </div>`,
    });

    if (!result.ok) {
      // Email no configurado (falta RESEND_API_KEY/EMAIL_FROM) o falló el
      // envío: en dev logueamos el link para poder probar el flujo igual.
      console.warn(
        `[auth/forgot] no se pudo enviar el email (${result.error}). Link de reset para ${user.email}: ${link}`,
      );
    }
  }

  return NextResponse.json({ ok: true });
}
