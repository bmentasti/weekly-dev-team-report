import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getProvider } from "@/lib/integrations/catalog";
import { getAdapter } from "@/lib/integrations/registry";
import { parseConnectionBody } from "@/lib/integrations/connect-helpers";

export async function POST(
  request: Request,
  { params }: { params: { provider: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const entry = getProvider(params.provider);
  const adapter = getAdapter(params.provider);
  if (!entry || !entry.enabled || !adapter) {
    return NextResponse.json(
      { error: "Integración no disponible." },
      { status: 404 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { config, secret, missing } = parseConnectionBody(entry, body);
  if (missing.length > 0) {
    return NextResponse.json(
      { ok: false, error: `Faltan campos: ${missing.join(", ")}` },
      { status: 200 },
    );
  }

  const result = await adapter.testConnection({ config, secret });
  return NextResponse.json(result);
}
