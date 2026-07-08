import { NextResponse } from "next/server";
import type { z } from "zod";

/**
 * Parseo + validación de body con zod para endpoints mutantes (H8).
 * Devuelve { data } o { error } listo para responder.
 */
export async function parseBody<T extends z.ZodTypeAny>(
  request: Request,
  schema: T,
): Promise<
  | { data: z.infer<T>; error?: undefined }
  | { data?: undefined; error: NextResponse }
> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      error: NextResponse.json({ error: "JSON inválido" }, { status: 400 }),
    };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      error: NextResponse.json(
        { error: "Datos inválidos", issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      ),
    };
  }
  return { data: parsed.data };
}

/**
 * Rate limiter en memoria por clave (IP+ruta). Suficiente para una sola
 * instancia; en multi-instancia migrar a Redis/Upstash. (H10)
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  key: string,
  { limit = 10, windowMs = 60_000 }: { limit?: number; windowMs?: number } = {},
): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  b.count += 1;
  if (b.count > limit) {
    return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfter: 0 };
}

/** IP del request (mejor esfuerzo detrás de proxy). */
export function clientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  return xff?.split(",")[0]?.trim() || "unknown";
}

export function tooMany(retryAfter: number): NextResponse {
  return NextResponse.json(
    { error: "Demasiados intentos. Probá de nuevo en unos segundos." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}
