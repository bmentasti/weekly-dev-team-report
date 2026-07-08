import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveWorkspaceForUser, resolveWorkspaceRole } from "@/lib/workspace";
import { can } from "@/lib/permissions";
import { listAudit } from "@/lib/audit";
import { BillingManager } from "@/components/billing-manager";
import {
  PLANS,
  limitLabel,
  effectivePlan,
  isTrialActive,
  trialDaysLeft,
  type PlanTierName,
} from "@/lib/plans";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BillingPeriodName } from "@/lib/plans";

function Usage({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number | null;
}) {
  const over = max !== null && value > max;
  return (
    <div className="rounded-input border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-bold ${over ? "text-destructive" : ""}`}>
        {value}
        <span className="text-sm font-normal text-muted-foreground">
          {" "}
          / {limitLabel(max)}
        </span>
      </div>
    </div>
  );
}

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  const workspace = await resolveWorkspaceForUser(session!.user.id);

  if (!workspace) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Ajustes</h1>
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Creá un workspace para ver los ajustes.
          </CardContent>
        </Card>
      </div>
    );
  }

  const storedPlan = workspace.plan as PlanTierName; // el que se paga
  const plan = effectivePlan(workspace); // efectivo (Pro durante el trial)
  const def = PLANS[plan];
  const onTrial = isTrialActive(workspace);
  const daysLeft = trialDaysLeft(workspace);
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const [projects, members, reportsThisMonth] = await Promise.all([
    prisma.project.count({ where: { workspaceId: workspace.id } }),
    prisma.workspaceMember.count({ where: { workspaceId: workspace.id } }),
    prisma.report.count({
      where: { workspaceId: workspace.id, createdAt: { gte: startOfMonth } },
    }),
  ]);

  const accessRole = await resolveWorkspaceRole(session!.user.id, workspace.id);
  const audit = can(accessRole, "viewAudit")
    ? await listAudit(workspace.id, 20)
    : [];

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Ajustes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Plan, facturación y uso de {workspace.name}.
        </p>
      </div>

      {onTrial && (
        <div className="rounded-card border border-primary/30 bg-primary/5 px-5 py-4">
          <p className="text-sm font-semibold">
            Prueba de Pro activa · {daysLeft} día{daysLeft === 1 ? "" : "s"} restantes
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Estás usando todas las funciones de Pro. Al terminar, tu workspace
            vuelve al plan {PLANS[storedPlan].name} — no perdés datos.
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Uso actual · plan {def.name}
            {onTrial ? " (prueba)" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Usage label="Proyectos" value={projects} max={def.maxProjects} />
          <Usage label="Usuarios" value={members} max={def.maxMembers} />
          <Usage
            label="Reportes este mes"
            value={reportsThisMonth}
            max={def.maxReportsPerMonth}
          />
          <div className="rounded-input border p-3">
            <div className="text-xs text-muted-foreground">Integraciones</div>
            <div className="text-lg font-bold">{def.integrationsLabel}</div>
          </div>
          <div className="rounded-input border p-3">
            <div className="text-xs text-muted-foreground">Histórico</div>
            <div className="text-lg font-bold">
              {def.historyMonths === null ? "Ilimitado" : `${def.historyMonths} meses`}
            </div>
          </div>
          <div className="rounded-input border p-3">
            <div className="text-xs text-muted-foreground">Export</div>
            <div className="text-lg font-bold">
              {def.pdfExport ? "CSV + PDF" : "CSV"}
            </div>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Cambiar de plan</h2>
        <BillingManager
          currentPlan={storedPlan}
          currentPeriod={workspace.billingPeriod as BillingPeriodName}
        />
      </div>

      {can(accessRole, "viewAudit") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Actividad reciente (auditoría)</CardTitle>
          </CardHeader>
          <CardContent>
            {audit.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sin actividad registrada todavía. Se registran cambios de plan,
                integraciones, roles y compartidos.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {audit.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-start gap-3 border-b pb-2 last:border-0 last:pb-0"
                  >
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                    <div className="flex-1">
                      <p>
                        <span className="font-medium">{a.actorName ?? "Alguien"}</span>{" "}
                        · {a.action}
                        {a.target ? ` · ${a.target}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(a.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
