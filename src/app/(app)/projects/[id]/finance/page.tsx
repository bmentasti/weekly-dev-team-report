import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canFinance } from "@/lib/finance/access";
import { loadFinancialSnapshot } from "@/lib/finance/load";
import { effectivePlan, financeEnabled } from "@/lib/plans";
import { getLocale } from "@/lib/i18n/server";
import { Card, CardContent } from "@/components/ui/card";
import { FinanceDashboard } from "./FinanceDashboard";
import { FinanceSetup, type FinanceConfigInitial } from "./FinanceSetup";
import { FinanceSimulator } from "./FinanceSimulator";
import { FinanceScenarios } from "./FinanceScenarios";
import { financeLabels } from "./i18n";

export const dynamic = "force-dynamic";

const db = prisma as any;

function dec(v: unknown): number | null {
  if (v == null) return null;
  const n =
    typeof v === "object" && v !== null && "toNumber" in (v as object)
      ? (v as { toNumber: () => number }).toNumber()
      : Number(v);
  return Number.isFinite(n) ? n : null;
}

async function loadInitialConfig(projectId: string): Promise<FinanceConfigInitial | undefined> {
  const c = await db.projectFinance.findUnique({ where: { projectId } });
  if (!c) return undefined;
  const pc = (c.progressConfig ?? {}) as Record<string, unknown>;
  return {
    modality: c.modality ?? "FIXED_PRICE",
    currency: c.currency ?? "USD",
    contractedRevenue: dec(c.contractedRevenue),
    originalCostBudget: dec(c.originalCostBudget),
    targetMarginPct: dec(c.targetMarginPct),
    startDate: c.startDate ? new Date(c.startDate).toISOString() : null,
    plannedEndDate: c.plannedEndDate ? new Date(c.plannedEndDate).toISOString() : null,
    contractualEndDate: c.contractualEndDate ? new Date(c.contractualEndDate).toISOString() : null,
    forecastEndDate: c.forecastEndDate ? new Date(c.forecastEndDate).toISOString() : null,
    manualPct: typeof pc.manualPct === "number" ? (pc.manualPct as number) : null,
  };
}

export default async function ProjectFinancePage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  const userId = session!.user.id;
  const L = financeLabels(getLocale());

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      workspace: { select: { plan: true, trialEndsAt: true } },
    },
  });

  if (!project) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {L.projectNotFound}
        </CardContent>
      </Card>
    );
  }

  // Gating por plan: el módulo es exclusivo de Team y Pro.
  if (!financeEnabled(effectivePlan(project.workspace))) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{L.title}</h1>
        <Card>
          <CardContent className="space-y-3 py-10 text-center">
            <p className="text-base font-semibold">{L.upsellTitle}</p>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">{L.upsellBody}</p>
            <p>
              <Link href="/settings" className="text-sm text-primary underline">
                {L.upsellCta}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canView = await canFinance(userId, params.id, "viewFinancials");
  if (!canView) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {L.noAccessRole}
        </CardContent>
      </Card>
    );
  }

  const result = await loadFinancialSnapshot(params.id);
  const canEdit = await canFinance(userId, params.id, "editFinancials");

  if (!result) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{L.title}</h1>
        <p className="text-sm text-muted-foreground">
          {project.name} · {L.notConfigured}
        </p>
        {canEdit ? (
          <FinanceSetup projectId={project.id} mode="create" labels={L} />
        ) : (
          <Card>
            <CardContent className="space-y-3 py-10 text-center">
              <p className="text-sm text-muted-foreground">{L.askAdmin}</p>
              <p>
                <Link href="/projects" className="text-sm text-primary underline">
                  {L.backToProjects}
                </Link>
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  const canMargins = await canFinance(userId, params.id, "viewMargins");
  const canExport = await canFinance(userId, params.id, "exportFinancials");
  const initialConfig = canEdit ? await loadInitialConfig(params.id) : undefined;

  return (
    <div className="space-y-6">
      <FinanceDashboard
        snapshot={result.snapshot}
        canViewMargins={canMargins}
        projectName={project.name}
        projectId={project.id}
        canExport={canExport}
        labels={L}
      />
      {canMargins && (
        <FinanceSimulator
          sim={{
            currency: result.snapshot.currency,
            modality: result.snapshot.modality,
            projectedProfit: result.snapshot.profitability.projectedProfit.value,
            projectedRevenue: result.snapshot.profitability.projectedTotalRevenue.value,
            dailyDelayCost: result.snapshot.temporal.incrementalDailyDelayCost.value,
            breakEvenDelayDays: result.snapshot.temporal.breakEvenDelayDays.value,
            workingDaysPerWeek: result.snapshot.temporal.workingDaysPerWeek,
          }}
          labels={L}
        />
      )}
      <FinanceScenarios snapshot={result.snapshot} canViewMargins={canMargins} labels={L} />
      {canEdit && (
        <details className="rounded-card border bg-card">
          <summary className="cursor-pointer px-6 py-4 text-sm font-medium">{L.configAndData}</summary>
          <div className="px-2 pb-2">
            <FinanceSetup projectId={project.id} initial={initialConfig} mode="edit" labels={L} />
          </div>
        </details>
      )}
    </div>
  );
}
