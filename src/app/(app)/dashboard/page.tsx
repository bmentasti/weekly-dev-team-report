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
import { PROVIDER_LIST, getProviderByType } from "@/lib/integrations/catalog";
import { computeCoverage } from "@/lib/intelligence/coverage";
import { computeHealth } from "@/lib/intelligence/health";
import { generateRecommendations } from "@/lib/intelligence/recommendations";
import {
  type ConnectedSource,
} from "@/lib/intelligence/types";
import { ProjectHealthMap, InsightCallout } from "@/components/viz";
import { recoText } from "@/components/intelligence";
import { getT } from "@/lib/i18n/server";
import { resolveActiveProject } from "@/lib/project";
import { levelOf, levelVariant } from "@/lib/reports/score";
import {
  getEffectiveStandard,
  resolveReportScore,
} from "@/lib/reports/standards-server";
import type { HealthLevel, ReportMetrics } from "@/lib/reports/types";
import { getOnboardingState } from "@/lib/onboarding";
import { OnboardingChecklist } from "@/components/onboarding-checklist";

export default async function DashboardPage() {
  const { t } = getT();
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

  // Intelligence Engine sobre las fuentes conectadas (datos reales).
  const sources: ConnectedSource[] = integrations.map((i) => {
    const provider = getProviderByType(i.type as string);
    return {
      slug: provider?.slug ?? String(i.type),
      label: provider?.label ?? String(i.type),
      status: i.status as ConnectedSource["status"],
      lastSyncAt: i.updatedAt,
    };
  });
  const coverage = computeCoverage(sources);
  const health = computeHealth(coverage);
  const recommendations = generateRecommendations(coverage);

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
        <p className="text-sm text-muted-foreground">{t("dash.subtitle")}</p>
      </div>

      {connectedCount > 0 && (
        <Card>
          <CardContent className="grid gap-6 py-6 lg:grid-cols-[auto_1fr] lg:items-center">
            <div className="flex justify-center">
              <ProjectHealthMap
                overall={health.overall}
                size={230}
                dimensions={health.dimensions.map((d) => ({
                  key: d.key,
                  label: d.label,
                  score: d.score,
                }))}
              />
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-input border p-3">
                  <p className="text-2xl font-bold tabular-nums">{coverage.overall}%</p>
                  <p className="text-xs text-muted-foreground">
                    {t("dash.coverage")} · {t(`lib.coverageLevel.${coverage.level}`)}
                  </p>
                </div>
                <div className="rounded-input border p-3">
                  <p className="text-2xl font-bold tabular-nums">
                    {coverage.categoriesCovered}
                    <span className="text-base text-muted-foreground">/{coverage.totalDimensions}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{t("dash.dimsWithData")}</p>
                </div>
                <div className="rounded-input border p-3">
                  <p className="text-2xl font-bold tabular-nums">{connectedCount}</p>
                  <p className="text-xs text-muted-foreground">{t("dash.activeIntegrations")}</p>
                </div>
              </div>
              {recommendations[0] && (
                <InsightCallout
                  intent={recommendations[0].priority === "high" ? "danger" : "warning"}
                  title={recoText(recommendations[0], t).title}
                >
                  {recoText(recommendations[0], t).action}
                </InsightCallout>
              )}
              <Button variant="outline" size="sm" asChild>
                <Link href="/reports/intelligence">{t("dash.viewIntelligence")}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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
                      {t(`lib.level.${p.level}`)}
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
