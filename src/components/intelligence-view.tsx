"use client";

import { useState } from "react";
import {
  CoverageOverview,
  RecommendationCard,
  DataConflictCard,
  EmptyState,
  recoText,
} from "@/components/intelligence";
import { ProjectHealthMap, InsightCallout } from "@/components/viz";
import { useT } from "@/components/i18n-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CoverageReport } from "@/lib/intelligence/types";
import type { HealthReport } from "@/lib/intelligence/health";
import type { Recommendation } from "@/lib/intelligence/recommendations";
import type { DataConflict } from "@/lib/intelligence/conflicts";
import type { ReportSection, SectionState } from "@/lib/intelligence/report";

const TABS = [
  { id: "overview", label: "intel.tab.overview" },
  { id: "coverage", label: "intel.tab.coverage" },
  { id: "recommendations", label: "intel.tab.recommendations" },
  { id: "conflicts", label: "intel.tab.conflicts" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const SECTION_STATE_VARIANT: Record<
  SectionState,
  "success" | "info" | "warning" | "outline" | "destructive"
> = {
  AVAILABLE: "success",
  PARTIAL: "info",
  LIMITED: "warning",
  NO_DATA: "outline",
  STALE: "destructive",
};

export interface IntelligenceViewProps {
  coverage: CoverageReport;
  health: HealthReport;
  recommendations: Recommendation[];
  conflicts: DataConflict[];
  sections: ReportSection[];
}

export function IntelligenceView({
  coverage,
  health,
  recommendations,
  conflicts,
  sections,
}: IntelligenceViewProps) {
  const [tab, setTab] = useState<TabId>("overview");
  const { t } = useT();

  return (
    <div className="space-y-5">
      <div
        role="tablist"
        aria-label={t("intel.title")}
        className="flex flex-wrap gap-1 border-b"
      >
        {TABS.map((item) => {
          const active = tab === item.id;
          const count =
            item.id === "recommendations"
              ? recommendations.length
              : item.id === "conflicts"
                ? conflicts.length
                : 0;
          return (
            <button
              key={item.id}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(item.id)}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t(item.label)}
              {count > 0 && (
                <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardContent className="flex flex-col items-center py-6">
              <p className="mb-2 self-start font-semibold">{t("intel.healthMapTitle")}</p>
              <ProjectHealthMap
                overall={health.overall}
                dimensions={health.dimensions.map((d) => ({
                  key: d.key,
                  label: d.label,
                  score: d.score,
                }))}
              />
            </CardContent>
          </Card>

          <div className="space-y-4">
            {recommendations[0] && (
              <InsightCallout
                intent={recommendations[0].priority === "high" ? "danger" : "warning"}
                title={recoText(recommendations[0], t).title}
              >
                {recoText(recommendations[0], t).action}
              </InsightCallout>
            )}
            <Card>
              <CardContent className="py-5">
                <p className="font-semibold">{t("intel.sectionsTitle")}</p>
                <p className="mb-3 text-xs text-muted-foreground">
                  {t("intel.sectionsSubtitle")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {sections.map((s) => (
                    <Badge key={s.key} variant={SECTION_STATE_VARIANT[s.state]}>
                      {s.label}: {t(`lib.intel.sectionState.${s.state}`)}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {tab === "coverage" && <CoverageOverview report={coverage} />}

      {tab === "recommendations" &&
        (recommendations.length === 0 ? (
          <EmptyState
            title={t("intel.recsEmptyTitle")}
            description={t("intel.recsEmptyDesc")}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {recommendations.map((r) => (
              <RecommendationCard key={r.id} rec={r} />
            ))}
          </div>
        ))}

      {tab === "conflicts" &&
        (conflicts.length === 0 ? (
          <EmptyState
            title={t("intel.conflictsEmptyTitle")}
            description={t("intel.conflictsEmptyDesc")}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {conflicts.map((c, i) => (
              <DataConflictCard key={i} conflict={c} />
            ))}
          </div>
        ))}
    </div>
  );
}
