import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listProjectsForUser } from "@/lib/project";
import { canFinance } from "@/lib/finance/access";
import { loadFinancialSnapshot } from "@/lib/finance/load";
import { generateAlerts, topAlert } from "@/lib/finance";
import { getLocale } from "@/lib/i18n/server";
import { Card, CardContent } from "@/components/ui/card";
import { financeLabels } from "../projects/[id]/finance/i18n";
import { PortfolioTable, type PortfolioRow } from "./PortfolioTable";

export const dynamic = "force-dynamic";

export default async function FinancePortfolioPage() {
  const session = await getServerSession(authOptions);
  const userId = session!.user.id;
  const L = financeLabels(getLocale());

  const projects = await listProjectsForUser(userId);
  const rows: PortfolioRow[] = [];
  const pending: { id: string; name: string }[] = [];

  for (const p of projects) {
    if (!(await canFinance(userId, p.id, "viewFinancials"))) continue;
    const result = await loadFinancialSnapshot(p.id);
    if (!result) {
      // Configurable: el usuario puede activar el módulo en este proyecto.
      if (await canFinance(userId, p.id, "editFinancials")) pending.push({ id: p.id, name: p.name });
      continue;
    }
    const s = result.snapshot;
    const canMargins = await canFinance(userId, p.id, "viewMargins");
    const alert = topAlert(generateAlerts(s, { hasMargins: canMargins }));
    rows.push({
      id: p.id,
      name: p.name,
      currency: s.currency,
      modality: s.modality,
      status: s.status.status,
      projectedProfit: s.profitability.projectedProfit.value,
      projectedMarginPct: s.profitability.projectedMarginPct.value,
      cpi: s.evm.cpi.value,
      spi: s.evm.spi.value,
      eac: s.evm.eac.value,
      remainingBudget: s.budget.remainingBudget.value,
      runwayDays: s.budget.runwayDays.value,
      topRisk: alert?.explanation ?? null,
      canViewMargins: canMargins,
    });
  }

  const nothing = rows.length === 0 && pending.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{L.portfolioTitle}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{L.portfolioSubtitle}</p>
      </div>

      {rows.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <PortfolioTable rows={rows} labels={L} />
          </CardContent>
        </Card>
      )}

      {/* Proyectos accesibles pero sin configuración financiera: CTA configurar. */}
      {pending.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="mb-3 text-sm font-medium">{L.pendingTitle}</p>
            <ul className="divide-y">
              {pending.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2.5">
                  <span className="text-sm">{p.name}</span>
                  <Link
                    href={`/projects/${p.id}/finance`}
                    className="rounded-input bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    {L.configure}
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {nothing && (
        <Card>
          <CardContent className="space-y-3 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              {projects.length === 0 ? L.createProjectHint : L.noPortfolio}
            </p>
            <p>
              <Link href="/projects" className="text-sm text-primary underline">
                {L.goToProjects}
              </Link>
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
