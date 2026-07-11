import { getServerSession } from "next-auth";
import { Sparkles } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveActiveProject } from "@/lib/project";
import { getProviderByType } from "@/lib/integrations/catalog";
import { computeCoverage } from "@/lib/intelligence/coverage";
import { computeHealth } from "@/lib/intelligence/health";
import { generateRecommendations } from "@/lib/intelligence/recommendations";
import { buildAdaptiveReport } from "@/lib/intelligence/report";
import type { ConnectedSource } from "@/lib/intelligence/types";
import type { DataConflict } from "@/lib/intelligence/conflicts";
import { IntelligenceView } from "@/components/intelligence-view";
import { Card, CardContent } from "@/components/ui/card";
import { getT } from "@/lib/i18n/server";

export const metadata = { title: "Inteligencia — DevMetrics" };

export default async function IntelligencePage() {
  const { t } = getT();
  const session = await getServerSession(authOptions);
  const project = await resolveActiveProject(session!.user.id);

  const integrations = project
    ? await prisma.integration.findMany({ where: { projectId: project.id } })
    : [];

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
  const { sections } = buildAdaptiveReport(coverage);
  // Los conflictos requieren datos cross-fuente ya correlacionados y persistidos
  // (etapa siguiente); por ahora se muestran con estado vacío honesto.
  const conflicts: DataConflict[] = [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
          <Sparkles className="h-6 w-6 text-primary" />
          {t("intel.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("intel.subtitle")}
          {project ? ` · ${project.name}` : ""}
        </p>
      </div>

      {coverage.connectedCount === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="font-semibold">{t("intel.emptyTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("intel.emptyDesc")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <IntelligenceView
          coverage={coverage}
          health={health}
          recommendations={recommendations}
          conflicts={conflicts}
          sections={sections}
        />
      )}
    </div>
  );
}
