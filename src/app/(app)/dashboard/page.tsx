import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PROVIDER_LIST } from "@/lib/integrations/catalog";
import { resolveActiveProject } from "@/lib/project";
import { levelOf, LEVEL_LABEL, levelVariant } from "@/lib/reports/score";
import {
  getEffectiveStandard,
  resolveReportScore,
} from "@/lib/reports/standards-server";
import type { HealthLevel, ReportMetrics } from "@/lib/reports/types";
import { getOnboardingState } from "@/lib/onboarding";
import { OnboardingChecklist } from "@/components/onboarding-checklist";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const userId = session!.user.id;

  const project = await resolveActiveProject(userId);

  if (!project) {
    return (
      <div className="mx-auto max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>Creá tu primer workspace</CardTitle>
            <CardDescription>
              Un workspace agrupa tus proyectos, integraciones y reportes. Es el
              primer paso para generar tu reporte.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/workspace/new">Crear workspace</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const integrations = await prisma.integration.findMany({
    where: { projectId: project.id },
  });
  const statusByType = new Map(
    integrations.map((i) => [i.type as string, i.status]),
  );
  const connectedCount = integrations.filter(
    (i) => i.status === "CONNECTED",
  ).length;
  const enabledCount = PROVIDER_LIST.filter((p) => p.enabled).length;
  const connectedProviders = PROVIDER_LIST.filter(
    (p) => statusByType.get(p.type) === "CONNECTED",
  );

  // Salud por proyecto (cross-proyecto) del workspace.
  const wsProjects = await prisma.project.findMany({
    where: { workspaceId: project.workspaceId },
    orderBy: { createdAt: "asc" },
    include: {
      reports: {
        orderBy: { periodEnd: "desc" },
        take: 1,
        select: {
          healthStatus: true,
          score: true,
          scoreLevel: true,
          metrics: true,
          periodEnd: true,
        },
      },
    },
  });
  const standard = await getEffectiveStandard(project.workspaceId);
  const projectHealth = wsProjects.map((p) => {
    const last = p.reports[0];
    let score: number | null = null;
    let level: ReturnType<typeof levelOf> | null = null;
    if (last) {
      const resolved = resolveReportScore(
        { score: last.score, scoreLevel: last.scoreLevel },
        last.metrics as ReportMetrics | null,
        last.healthStatus as HealthLevel | null,
        standard,
      );
      score = resolved.score;
      level = resolved.level;
    }
    return {
      id: p.id,
      name: p.name,
      score,
      level,
      lastAt: last?.periodEnd ?? null,
      active: p.id === project.id,
    };
  });

  const onboarding = await getOnboardingState(userId, session!.user.role ?? null);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <OnboardingChecklist state={onboarding} variant="compact" />

      <div>
        <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
        <p className="text-sm text-muted-foreground">
          Overview del proyecto — integraciones, equipo y reportes.
        </p>
      </div>

      {projectHealth.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Salud por proyecto</CardTitle>
            <CardDescription>
              Estado del último reporte de cada proyecto del workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projectHealth.map((p) => (
              <div
                key={p.id}
                className={`rounded-input border p-3 ${p.active ? "border-primary" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{p.name}</span>
                  {p.level ? (
                    <Badge variant={levelVariant(p.level)}>
                      {LEVEL_LABEL[p.level]}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">sin datos</span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {p.score !== null ? `Salud ${p.score}/100` : "Sin reportes aún"}
                  {p.active ? " · activo" : ""}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {connectedCount === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">
              Todavía no conectaste ninguna herramienta
            </CardTitle>
            <CardDescription>
              Conectá tus herramientas para generar tu reporte semanal. Cuantas
              más fuentes conectes, más completo es el cruce por equipo y persona.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-xl">Reporte semanal</CardTitle>
            <CardDescription>
              {connectedCount} herramienta(s) conectada(s). Generá un reporte que
              cruza avance, PRs, bloqueos y riesgos por equipo y persona.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/reports">Generar reporte</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/reports">Ver historial</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Herramientas conectadas</CardTitle>
            <CardDescription>
              {connectedCount} de {enabledCount} fuentes activas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {connectedProviders.length === 0 && (
                <span className="text-sm text-muted-foreground">
                  Ninguna conectada todavía.
                </span>
              )}
              {connectedProviders.map((p) => (
                <Badge key={p.slug} variant="success">
                  {p.label}
                </Badge>
              ))}
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/integrations">Gestionar integraciones</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Equipo</CardTitle>
            <CardDescription>
              Gestioná quién forma parte del workspace y compartí reportes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" asChild>
              <Link href="/teams">Ver equipo</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
