"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getProvider } from "@/lib/integrations/catalog";
import { BackButton } from "@/components/back-button";
import { useT } from "@/components/i18n-provider";
import type {
  ActivitySignal,
  ProviderData,
  UnifiedCodeChange,
  UnifiedWorkItem,
} from "@/lib/integrations/types";

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

function formatAge(hours: number): string {
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

function WorkItems({
  items,
  t,
}: {
  items: UnifiedWorkItem[];
  t: (key: string) => string;
}) {
  const done = items.filter((i) => i.bucket === "DONE").length;
  const inProgress = items.filter((i) => i.bucket === "IN_PROGRESS").length;
  const blocked = items.filter((i) => i.bucket === "BLOCKED").length;
  const stale = items.filter((i) => i.isStale).length;
  const critical = items.filter((i) => i.isCritical).length;

  function bucketBadge(i: UnifiedWorkItem) {
    if (i.bucket === "BLOCKED")
      return <Badge variant="destructive">{t("ws.data.blocked")}</Badge>;
    if (i.bucket === "DONE") return <Badge variant="success">{t("ws.data.done")}</Badge>;
    if (i.bucket === "IN_PROGRESS")
      return <Badge variant="info">{t("ws.data.inProgress")}</Badge>;
    return <Badge variant="secondary">{t("ws.data.todo")}</Badge>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Metric label={t("ws.data.total")} value={items.length} />
        <Metric label={t("ws.data.doneCount")} value={done} />
        <Metric label={t("ws.data.inProgressCount")} value={inProgress} />
        <Metric label={t("ws.data.blockedCount")} value={blocked} />
        <Metric label={t("ws.data.stale")} value={stale} />
        <Metric label={t("ws.data.critical")} value={critical} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{`${items.length} ${t("ws.data.tasks")}`}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label={t("ws.data.tasksAria")}>
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th scope="col" className="py-2 pr-4 font-medium">{t("ws.data.colId")}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t("ws.data.colTitle")}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t("ws.data.colStatus")}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t("ws.data.colAssignee")}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t("ws.data.colPriority")}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t("ws.data.colSignals")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.externalId} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-mono text-xs">
                      <a
                        href={i.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                      >
                        {i.externalId}
                      </a>
                    </td>
                    <td className="max-w-xs truncate py-2 pr-4" title={i.title}>
                      {i.title}
                    </td>
                    <td className="py-2 pr-4">{bucketBadge(i)}</td>
                    <td className="py-2 pr-4">
                      {i.assignee ?? (
                        <span className="text-muted-foreground">{t("ws.data.unassigned")}</span>
                      )}
                    </td>
                    <td className="py-2 pr-4">{i.priority ?? "—"}</td>
                    <td className="py-2 pr-4">
                      <div className="flex flex-wrap gap-1">
                        {i.isCritical && (
                          <Badge variant="destructive">{t("ws.data.criticalBadge")}</Badge>
                        )}
                        {i.isStale && (
                          <Badge variant="warning">{t("ws.data.staleBadge")}</Badge>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-muted-foreground">
                      {t("ws.data.noTasks")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CodeChanges({
  items,
  t,
}: {
  items: UnifiedCodeChange[];
  t: (key: string) => string;
}) {
  const open = items.filter((i) => i.state === "OPEN");
  const merged = items.filter((i) => i.state === "MERGED").length;
  const withoutReviewer = open.filter((i) => !i.hasReviewer).length;
  const failing = open.filter((i) => i.checksState === "failure").length;
  const old = open.filter((i) => i.isOld).length;
  const avgAge =
    open.length > 0
      ? Math.round(open.reduce((s, i) => s + i.ageHours, 0) / open.length)
      : 0;

  function stateBadge(i: UnifiedCodeChange) {
    if (i.state === "MERGED") return <Badge variant="success">{t("ws.data.merged")}</Badge>;
    if (i.state === "CLOSED")
      return <Badge variant="secondary">{t("ws.data.closedNoMerge")}</Badge>;
    return <Badge variant="info">{t("ws.data.open")}</Badge>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Metric label={t("ws.data.openCount")} value={open.length} />
        <Metric label={t("ws.data.mergedCount")} value={merged} />
        <Metric label={t("ws.data.noReviewer")} value={withoutReviewer} />
        <Metric label={t("ws.data.checksFailing")} value={failing} />
        <Metric label={t("ws.data.open72h")} value={old} />
        <Metric label={t("ws.data.avgAge")} value={formatAge(avgAge)} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {`${items.length} ${t("ws.data.prMr")}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label={t("ws.data.prMrAria")}>
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th scope="col" className="py-2 pr-4 font-medium">#</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t("ws.data.colTitle")}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t("ws.data.colAuthor")}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t("ws.data.colStatus")}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t("ws.data.colAge")}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t("ws.data.colSignals")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.externalId} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-mono text-xs">
                      <a
                        href={i.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                      >
                        #{i.externalId}
                      </a>
                    </td>
                    <td className="max-w-xs truncate py-2 pr-4" title={i.title}>
                      {i.title}
                    </td>
                    <td className="py-2 pr-4">{i.author ?? "—"}</td>
                    <td className="py-2 pr-4">{stateBadge(i)}</td>
                    <td className="py-2 pr-4">
                      {i.state === "OPEN" ? formatAge(i.ageHours) : "—"}
                    </td>
                    <td className="py-2 pr-4">
                      <div className="flex flex-wrap gap-1">
                        {i.isOld && <Badge variant="warning">{t("ws.data.oldBadge")}</Badge>}
                        {i.state === "OPEN" && !i.hasReviewer && (
                          <Badge variant="destructive">{t("ws.data.noReviewer")}</Badge>
                        )}
                        {i.draft && <Badge variant="outline">{t("ws.data.draft")}</Badge>}
                        {i.state === "OPEN" && i.checksState === "failure" && (
                          <Badge variant="destructive">{t("ws.data.checksFailing")}</Badge>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-muted-foreground">
                      {t("ws.data.noPrMr")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Activity({
  items,
  t,
}: {
  items: ActivitySignal[];
  t: (key: string) => string;
}) {
  const blockers = items.filter((i) => i.isBlocker);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Metric label={t("ws.data.messages")} value={items.length} />
        <Metric label={t("ws.data.possibleBlockers")} value={blockers.length} />
        <Metric
          label={t("ws.data.activePeople")}
          value={new Set(items.map((i) => i.author).filter(Boolean)).size}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("ws.data.recentActivity")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {t("ws.data.noRecentMessages")}
            </p>
          )}
          {items.map((i) => (
            <div
              key={i.externalId}
              className="flex items-start justify-between gap-4 border-b pb-3 last:border-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm">{i.text || t("ws.data.noText")}</p>
                <p className="text-xs text-muted-foreground">
                  {i.author ?? "?"}{" "}
                  {i.createdAt
                    ? `· ${new Date(i.createdAt).toLocaleString()}`
                    : ""}
                </p>
              </div>
              {i.isBlocker && <Badge variant="warning">{t("ws.data.possibleBlocker")}</Badge>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function IntegrationDataPage() {
  const { t } = useT();
  const params = useParams<{ provider: string }>();
  const slug = params.provider;
  const entry = getProvider(slug);

  const [data, setData] = useState<ProviderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/integrations/${slug}/data`);
      const json = (await res.json()) as { data?: ProviderData; error?: string };
      if (!res.ok) {
        setError(json.error ?? t("ws.data.loadError"));
        setData(null);
      } else {
        setData(json.data ?? {});
      }
    } catch {
      setError(t("ws.data.netError"));
    } finally {
      setLoading(false);
    }
  }, [slug, t]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <BackButton label={t("ws.integrationConnect.backToIntegrations")} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {entry?.label ?? slug}
          </h1>
          <p className="text-sm text-muted-foreground">{entry?.blurb}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/integrations/${slug}`}>{t("ws.data.editConnection")}</Link>
          </Button>
          <Button onClick={load} disabled={loading}>
            {loading ? t("ws.data.loading") : t("ws.data.refresh")}
          </Button>
        </div>
      </div>

      {error && (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" asChild>
              <Link href={`/integrations/${slug}`}>{t("ws.data.reviewConnection")}</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          {data.workItems && <WorkItems items={data.workItems} t={t} />}
          {data.codeChanges && <CodeChanges items={data.codeChanges} t={t} />}
          {data.activity && <Activity items={data.activity} t={t} />}
        </>
      )}
    </div>
  );
}
