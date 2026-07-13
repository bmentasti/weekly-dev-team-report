import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getReportAccess } from "@/lib/reports/access";
import { deliverReportByEmail } from "@/lib/reports/deliver";
import { getLocale } from "@/lib/i18n/server";

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

  const body = (await request.json().catch(() => ({}))) as {
    recipients?: string[];
  };

  const result = await deliverReportByEmail(
    params.id,
    body.recipients ?? [],
    getLocale(),
  );
  if (!result.ok)
    return NextResponse.json({ ok: false, error: result.error }, { status: 200 });

  return NextResponse.json({ ok: true, sent: result.sent });
}
