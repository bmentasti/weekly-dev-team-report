import Link from "next/link";
import { getServerSession } from "next-auth";
import { CheckCircle2, Info } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveActiveProject } from "@/lib/project";
import {
  PROVIDER_LIST,
  type ProviderSlug,
  type ProviderKind,
  type ProviderCatalogEntry,
} from "@/lib/integrations/catalog";
import { integrationAllowed, effectivePlan } from "@/lib/plans";
import { UpgradeButton } from "@/components/upgrade-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { SyncStatus } from "@/lib/integrations/health";
import {
  STATUS_LABEL_KEY,
  statusTone,
  TONE_DOT,
  TONE_TEXT,
} from "@/lib/integrations/status-display";
import { getT } from "@/lib/i18n/server";

// Los campos de salud del sync son nuevos en el modelo; hasta correr
// `prisma generate`/`db push` el cliente puede no tiparlos, así que los leemos
// vía una vista extendida opcional (best-effort).
type IntegrationHealth = {
  status: string;
  updatedAt: Date;
  lastSuccessfulSyncAt?: Date | null;
  recordsImported?: number | null;
  participantsLinked?: number | null;
  unassociatedRecords?: number | null;
  pendingIdentities?: number | null;
  recommendedAction?: string | null;
  lastErrorMessage?: string | null;
};

const BRAND_COLOR: Record<ProviderSlug, string> = {
  jira: "#2563FF",
  github: "#0B1D3A",
  slack: "#E01E5A",
  linear: "#5E6AD2",
  gitlab: "#FC6D26",
  bitbucket: "#2563FF",
  "azure-devops": "#0078D4",
  clickup: "#7B68EE",
  notion: "#0B1D3A",
  teams: "#4B53BC",
  airtable: "#FCB400",
  discord: "#5865F2",
  anthropic: "#D97757",
  openai: "#10A37F",
  gemini: "#1A73E8",
  copilot: "#0B1D3A",
  // Project Planning & Portfolio
  "ms-project": "#31752F",
  "ms-planner": "#31752F",
  "azure-boards": "#0078D4",
  monday: "#FF3D57",
  asana: "#F06A6A",
  smartsheet: "#003059",
  wrike: "#08CF65",
  teamwork: "#E1523D",
  basecamp: "#1DA032",
  trello: "#0079BF",
  shortcut: "#4999E9",
  "zoho-projects": "#E42527",
  primavera: "#C74634",
  "jira-align": "#2563FF",
  "jira-roadmaps": "#2563FF",
};

function timeAgo(date: Date, t: (key: string) => string): string {
  const mins = Math.round((Date.now() - date.getTime()) / 60000);
  const ago = t("ws.integrations.agoMinPrefix");
  const sp = ago ? `${ago} ` : "";
  if (mins < 1) return t("ws.integrations.now");
  if (mins < 60) return `${sp}${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${sp}${hrs}h`;
  return `${sp}${Math.round(hrs / 24)}d`;
}

export default async function IntegrationsPage() {
  const { t } = getT();
  const session = await getServerSession(authOptions);
  const project = await resolveActiveProject(session!.user.id);

  const workspace = project
    ? await prisma.workspace.findUnique({
        where: { id: project.workspaceId },
      })
    : null;
  const plan = effectivePlan(workspace);

  const integrations = project
    ? await prisma.integration.findMany({ where: { projectId: project.id } })
    : [];
  const byType = new Map(integrations.map((i) => [i.type as string, i]));

  const enabled = PROVIDER_LIST.filter((p) => p.enabled);
  const connectedCount = enabled.filter(
    (p) => byType.get(p.type)?.status === "CONNECTED",
  ).length;
  const pct = Math.round((connectedCount / enabled.length) * 100);

  const recent = [...integrations].sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
  );

  // Agrupación por categoría (kind), en un orden de negocio.
  const KIND_ORDER: ProviderKind[] = [
    "ISSUES",
    "CODE",
    "PLANNING",
    "COMM",
    "AI",
  ];
  const groups = KIND_ORDER.map((kind) => ({
    kind,
    items: PROVIDER_LIST.filter((p) => p.kind === kind),
  })).filter((g) => g.items.length > 0);

  const renderCard = (p: ProviderCatalogEntry) => {
    const integration = byType.get(p.type) as IntegrationHealth | undefined;
    // status es string en DB; lo tratamos como SyncStatus (11 estados) en vez de
    // la enum generada, que puede no incluir los nuevos hasta `prisma generate`.
    const status = integration?.status as SyncStatus | undefined;
    // "Operativo" = puede usarse para reportes (trae datos). Los estados nuevos
    // (SYNCING/PARTIALLY_SYNCED/RATE_LIMITED) siguen siendo usables.
    const isConnectedFamily =
      status === "CONNECTED" ||
      status === "SYNCING" ||
      status === "PARTIALLY_SYNCED" ||
      status === "RATE_LIMITED";
    const connected = isConnectedFamily; // muestra acciones de configurar/ver datos
    const tone = status ? statusTone(status) : "muted";
    const statusLabel = status
      ? t(STATUS_LABEL_KEY[status])
      : t("ws.integrations.notConnected");
    const records = integration?.recordsImported ?? null;
    const linked = integration?.participantsLinked ?? null;
    const unassociated = integration?.unassociatedRecords ?? null;
    const pending = integration?.pendingIdentities ?? null;
    const lastOk = integration?.lastSuccessfulSyncAt ?? null;
    const action = integration?.recommendedAction ?? null;
    const allowed = integrationAllowed(plan, p.type);
    return (
      <Card key={p.slug} className="flex flex-col">
        <CardContent className="flex flex-1 flex-col gap-3 py-5">
          <div className="flex items-start justify-between">
            <span
              className="flex h-11 w-11 items-center justify-center rounded-input text-base font-bold text-white"
              style={{ backgroundColor: BRAND_COLOR[p.slug] }}
            >
              {p.label.charAt(0)}
            </span>
            {!p.enabled && <Badge variant="outline">{t("ws.integrations.soon")}</Badge>}
          </div>
          <div>
            <p className="font-semibold">{p.label}</p>
            <p className="text-sm text-muted-foreground">{p.blurb}</p>
          </div>
          <div className="mt-auto">
            <div className="mb-1 flex flex-wrap items-center gap-2 text-sm">
              <span className={`h-2 w-2 rounded-full ${TONE_DOT[tone]}`} />
              <span className={TONE_TEXT[tone]}>{statusLabel}</span>
              {integration && lastOk && (
                <span className="text-xs text-muted-foreground">
                  · {t("ws.integrations.lastSuccess")} {timeAgo(lastOk, t)}
                </span>
              )}
              {integration && !lastOk && status && isConnectedFamily && (
                <span className="text-xs text-muted-foreground">
                  · {t("ws.integrations.noSuccessYet")}
                </span>
              )}
            </div>
            {integration && records != null && (
              <div className="mb-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                <span>
                  {records.toLocaleString()} {t("ws.integrations.records")}
                </span>
                {linked != null && linked > 0 && (
                  <span>
                    {linked} {t("ws.integrations.linked")}
                  </span>
                )}
                {pending != null && pending > 0 && (
                  <span className="text-warning">
                    {pending} {t("ws.integrations.pending")}
                  </span>
                )}
                {unassociated != null && unassociated > 0 && (
                  <span className="text-warning">
                    {unassociated} {t("ws.integrations.unassociated")}
                  </span>
                )}
              </div>
            )}
            {action && (
              <p className="mb-3 rounded-input bg-warning-soft px-2 py-1 text-[11px] leading-snug text-warning">
                <span className="font-medium">{t("ws.integrations.action")}:</span> {action}
              </p>
            )}
            {!p.enabled ? (
              <Button variant="outline" size="sm" className="w-full" disabled>
                {t("ws.integrations.comingSoon")}
              </Button>
            ) : connected ? (
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/integrations/${p.slug}`}>
                    {t("ws.integrations.configure")}
                  </Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/integrations/${p.slug}/data`}>
                    {t("ws.integrations.viewData")}
                  </Link>
                </Button>
              </div>
            ) : !allowed ? (
              <UpgradeButton
                className="w-full"
                feature={`${t("ws.integrations.upgradeFeaturePrefix")} ${p.label}`}
                suggestedPlan="Team"
              />
            ) : (
              <Button size="sm" className="w-full" asChild>
                <Link href={`/integrations/${p.slug}`}>{`${t("ws.integrations.connectPrefix")} ${p.label}`}</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {t("ws.integrations.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("ws.integrations.subtitle")}
        </p>
      </div>

      {/* Onboarding progress */}
      <Card>
        <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              ⚡
            </span>
            <div>
              <p className="font-semibold">
                {t("ws.integrations.connectMainApps")}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("ws.integrations.connectMainAppsDesc")}
              </p>
            </div>
          </div>
          <div className="sm:w-64">
            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
              <span>
                {`${connectedCount} ${t("ws.integrations.activeOf")} ${enabled.length} ${t("ws.integrations.active")}`}
              </span>
              <span>{pct}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Provider cards, agrupadas por categoría */}
        <div className="lg:col-span-2 space-y-8">
          {groups.map((g) => {
            const total = g.items.length;
            const active = g.items.filter(
              (p) => p.enabled && byType.get(p.type)?.status === "CONNECTED",
            ).length;
            return (
              <section key={g.kind}>
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    {t(`lib.kind.${g.kind}`)}
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {`${active}/${total} ${t("ws.integrations.connectedOfLower")}`}
                  </span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {g.items.map((p) => renderCard(p))}
                </div>
              </section>
            );
          })}
        </div>

        {/* Aside */}
        <div className="space-y-6">
          <Card className="bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Info className="h-4 w-4 text-primary" />
                {t("ws.integrations.whyMatter")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>{t("ws.integrations.whyMatterDesc")}</p>
              <ul className="mt-3 space-y-2">
                {[
                  t("ws.integrations.benefit1"),
                  t("ws.integrations.benefit2"),
                  t("ws.integrations.benefit3"),
                ].map((label) => (
                  <li key={label} className="flex items-center gap-2 text-foreground">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    {label}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t("ws.integrations.recentSyncActivity")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recent.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {t("ws.integrations.noActivity")}
                </p>
              )}
              {recent.map((i) => {
                const p = PROVIDER_LIST.find((x) => x.type === i.type);
                return (
                  <div key={i.id} className="flex items-center gap-3 text-sm">
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold text-white"
                      style={{
                        backgroundColor: p ? BRAND_COLOR[p.slug] : "#64748b",
                      }}
                    >
                      {p?.label.charAt(0) ?? "?"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {p?.label} —{" "}
                        <span className={TONE_TEXT[statusTone(i.status as SyncStatus)]}>
                          {t(STATUS_LABEL_KEY[i.status as SyncStatus])}
                        </span>
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {timeAgo(i.updatedAt, t)}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
