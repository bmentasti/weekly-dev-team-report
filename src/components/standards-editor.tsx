"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Lock,
  RotateCcw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Info,
  AlertTriangle,
  Layers,
  Gauge,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useDialogs } from "@/components/ui/dialog-provider";
import { cn } from "@/lib/utils";
import {
  DEFAULT_STANDARD,
  DIMENSION_LABEL,
  METRIC_DEFS,
  PRESETS,
  mergeStandard,
  scoreWithStandard,
  thresholdValid,
  weightsSum,
  computeBaselineThresholds,
  diffStandards,
  type HealthStandardConfig,
  type MetricCategory,
  type MetricDef,
  type ScoreDimension,
} from "@/lib/reports/standards";
import { levelVariant } from "@/lib/reports/score";
import type { ReportMetrics } from "@/lib/reports/types";
import { useT } from "@/components/i18n-provider";

type TFn = (key: string) => string;

const CATEGORY_TABS: MetricCategory[] = [
  "delivery",
  "quality",
  "product",
  "team",
];
type Tab = MetricCategory | "score";

const roleLabelKey: Record<string, string> = {
  TL: "rep2.se.role.TL",
  PO: "rep2.se.role.PO",
  DIR: "rep2.se.role.DIR",
  TODOS: "rep2.se.role.TODOS",
};

interface HistoryItem {
  id: string;
  reason: string | null;
  changedByName: string | null;
  createdAt: string;
  config: HealthStandardConfig;
}

/** ¿La config afloja estándares vs. el recomendado? (para pedir motivo) */
function isLoosening(config: HealthStandardConfig): boolean {
  if (config.weights.quality < DEFAULT_STANDARD.weights.quality) return true;
  for (const def of METRIC_DEFS) {
    const cur = config.thresholds[def.key];
    const base = DEFAULT_STANDARD.thresholds[def.key];
    if (!cur || !base) continue;
    if (def.direction === "higherIsBetter" && cur.healthy < base.healthy)
      return true;
    if (def.direction === "lowerIsBetter" && cur.healthy > base.healthy)
      return true;
  }
  return false;
}

export function StandardsEditor() {
  const { t } = useT();
  const dialogs = useDialogs();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [plan, setPlan] = useState<"FREE" | "TEAM" | "PRO">("FREE");
  const [custom, setCustom] = useState(false);
  const [persistenceReady, setPersistenceReady] = useState(true);
  const [config, setConfig] = useState<HealthStandardConfig>(DEFAULT_STANDARD);
  const [tab, setTab] = useState<Tab>("delivery");
  const [dirty, setDirty] = useState(false);
  const [previewMetrics, setPreviewMetrics] = useState<ReportMetrics | null>(null);
  const [scope, setScope] = useState<"workspace" | "project">("workspace");
  const [projectName, setProjectName] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [openDiff, setOpenDiff] = useState<string | null>(null);
  const [recentMetrics, setRecentMetrics] = useState<ReportMetrics[]>([]);

  // El scope proyecto requiere Pro; el de workspace, Team/Pro.
  const canEdit =
    scope === "project" ? plan === "PRO" : plan === "TEAM" || plan === "PRO";

  const load = useCallback(async (sc: "workspace" | "project") => {
    setLoading(true);
    try {
      const [stdRes, repRes] = await Promise.all([
        fetch(`/api/report-standards?scope=${sc}`),
        fetch("/api/reports"),
      ]);
      const data = await stdRes.json();
      setPlan(data.plan);
      setCustom(data.custom);
      setPersistenceReady(data.persistenceReady ?? true);
      setConfig(mergeStandard(data.standard));
      setProjectName(data.projectName ?? null);
      setHistory(data.history ?? []);
      setDirty(false);
      const reps = (await repRes.json()).reports ?? [];
      const withMetrics = (reps as { metrics: ReportMetrics | null }[])
        .filter((r) => r.metrics)
        .map((r) => r.metrics as ReportMetrics);
      setRecentMetrics(withMetrics.slice(0, 3));
      setPreviewMetrics(withMetrics[0] ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(scope);
  }, [scope, load]);

  const sum = weightsSum(config.weights);
  const weightsOk = sum === 100;
  const qualityFloorOk = config.weights.quality >= 5;
  const invalidMetrics = useMemo(
    () =>
      METRIC_DEFS.filter(
        (d) => !thresholdValid(d, config.thresholds[d.key]),
      ).map((d) => d.key),
    [config.thresholds],
  );
  const preview = useMemo(
    () => scoreWithStandard(previewMetrics, config),
    [previewMetrics, config],
  );
  const canSave =
    canEdit && dirty && weightsOk && qualityFloorOk && invalidMetrics.length === 0;

  function applyPreset(id: string) {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    setConfig(mergeStandard(p.config));
    setDirty(true);
  }

  function setThreshold(key: string, field: "healthy" | "risk", value: number) {
    setConfig((c) => ({
      ...c,
      thresholds: {
        ...c.thresholds,
        [key]: { ...c.thresholds[key], [field]: value },
      },
    }));
    setDirty(true);
  }

  function setWeight(dim: ScoreDimension, value: number) {
    setConfig((c) => ({ ...c, weights: { ...c.weights, [dim]: value } }));
    setDirty(true);
  }

  async function onEditAttemptFree() {
    await dialogs.upgrade({
      feature: t("rep2.se.dlg.upgradeFeature"),
      suggestedPlan: "Team",
    });
  }

  function restoreVersion(item: HistoryItem) {
    setConfig(mergeStandard(item.config));
    setDirty(true);
    setOpenDiff(null);
  }

  function applyBaseline() {
    if (recentMetrics.length < 2) {
      dialogs.alert({
        title: t("rep2.se.dlg.littleHistoryTitle"),
        description: t("rep2.se.dlg.littleHistoryDesc"),
      });
      return;
    }
    const th = computeBaselineThresholds(recentMetrics);
    setConfig((c) => ({ ...c, thresholds: { ...c.thresholds, ...th } }));
    setDirty(true);
  }

  async function onSave() {
    if (!canSave) return;
    // Motivo obligatorio si se aflojan estándares (gobernanza).
    let reason: string | undefined;
    if (isLoosening(config)) {
      const r = await dialogs.prompt({
        title: t("rep2.se.dlg.reasonTitle"),
        label: t("rep2.se.dlg.reasonLabel"),
        placeholder: t("rep2.se.dlg.reasonPlaceholder"),
        confirmLabel: t("rep2.se.dlg.reasonConfirm"),
      });
      if (!r) return; // canceló
      reason = r;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/report-standards", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, config, reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        await dialogs.alert({
          title: t("rep2.se.dlg.saveErrorTitle"),
          description: data.error ?? t("rep2.se.dlg.saveErrorDesc"),
        });
        return;
      }
      await dialogs.alert({
        title: t("rep2.se.dlg.savedTitle"),
        description: t("rep2.se.dlg.savedDesc"),
      });
      await load(scope); // refresca historial + estado
    } finally {
      setSaving(false);
    }
  }

  async function onRestore() {
    const ok = await dialogs.confirm({
      title: t("rep2.se.dlg.restoreTitle"),
      description:
        scope === "project"
          ? t("rep2.se.dlg.restoreProject")
          : t("rep2.se.dlg.restoreWorkspace"),
      confirmLabel: t("rep2.se.dlg.restoreConfirm"),
      danger: true,
    });
    if (!ok) return;
    setSaving(true);
    try {
      await fetch(`/api/report-standards?scope=${scope}`, { method: "DELETE" });
      await load(scope);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="h-40 animate-pulse rounded-card bg-muted" />
      </div>
    );
  }

  const planName = plan === "FREE" ? "Free" : plan === "TEAM" ? "Team" : "Pro";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">
              {t("rep2.se.title")}
            </h1>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {t("rep2.se.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={canEdit ? "success" : "secondary"}>{t("rep2.se.plan")} {planName}</Badge>
          <Badge variant={custom ? "info" : "outline"}>
            {custom ? t("rep2.se.customStandard") : t("rep2.se.recommendedStandard")}
          </Badge>
        </div>
      </div>

      {/* Alcance del estándar (workspace vs proyecto, con herencia) */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">{t("rep2.se.appliesTo")}</span>
        {(["workspace", "project"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setScope(s)}
            className={cn(
              "rounded-button border px-3 py-1.5 text-sm font-medium transition-colors",
              scope === s
                ? "border-primary bg-primary text-white"
                : "border-input text-muted-foreground hover:text-foreground",
            )}
          >
            {s === "workspace"
              ? t("rep2.se.workspace")
              : projectName
                ? `${t("rep2.se.projectPrefix")} ${projectName}`
                : t("rep2.se.currentProject")}
          </button>
        ))}
        {scope === "project" && (
          <span className="text-xs text-muted-foreground">
            {custom
              ? t("rep2.se.projectHasOverride")
              : t("rep2.se.projectInheriting")}
            {" "}{t("rep2.se.projectProNote")}
          </span>
        )}
      </div>

      {/* Aviso Free */}
      {!canEdit && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-input bg-primary/10 text-primary">
                <Lock className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold">
                  {scope === "project"
                    ? t("rep2.se.viewingInherited")
                    : t("rep2.se.viewingRecommended")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {scope === "project"
                    ? t("rep2.se.inheritedDesc")
                    : t("rep2.se.recommendedDesc")}
                </p>
              </div>
            </div>
            <Button asChild className="shrink-0">
              <Link href="/settings">{t("rep2.se.unlock")}</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Aviso persistencia (falta db:push) */}
      {canEdit && !persistenceReady && (
        <div className="flex items-start gap-2 rounded-input border border-warning/30 bg-warning-soft p-3 text-sm text-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {t("rep2.se.persistencePrefix")} <code>npm run db:push</code> {t("rep2.se.persistenceSuffix")}
          </span>
        </div>
      )}

      {/* Vista previa del score (config -> score real) */}
      <ScorePreview preview={preview} hasData={!!previewMetrics} />

      {/* Perfiles predefinidos */}
      {canEdit && (
        <div className="rounded-card border bg-card px-5 py-4">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">{t("rep2.se.presets")}</h3>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("rep2.se.presetsDesc")}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => applyPreset(p.id)}
                title={p.when}
                className="rounded-button border border-input px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
              >
                {p.name}
              </button>
            ))}
          </div>

          {plan === "PRO" && (
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t pt-4">
              <Button variant="outline" size="sm" onClick={applyBaseline}>
                <History className="mr-2 h-4 w-4" />
                {t("rep2.se.suggestFromHistory")}
              </Button>
              <span className="text-xs text-muted-foreground">
                {t("rep2.se.baselinePrefix")} {recentMetrics.length || "—"} {t("rep2.se.baselineSuffix")}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {CATEGORY_TABS.map((c) => (
          <TabButton key={c} active={tab === c} onClick={() => setTab(c)}>
            {t(`lib.category.${c}`)}
          </TabButton>
        ))}
        <TabButton active={tab === "score"} onClick={() => setTab("score")}>
          {t("rep2.se.scoreTab")}
        </TabButton>
      </div>

      {/* Contenido */}
      {tab === "score" ? (
        <ScorePanel
          weights={config.weights}
          sum={sum}
          ok={weightsOk}
          canEdit={canEdit}
          onChange={setWeight}
          onLocked={onEditAttemptFree}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {METRIC_DEFS.filter((m) => m.category === tab).map((def) => (
            <ThresholdCard
              key={def.key}
              def={def}
              healthy={config.thresholds[def.key].healthy}
              risk={config.thresholds[def.key].risk}
              invalid={invalidMetrics.includes(def.key)}
              canEdit={canEdit}
              onChange={setThreshold}
              onLocked={onEditAttemptFree}
            />
          ))}
        </div>
      )}

      {/* Historial de cambios */}
      {canEdit && history.length > 0 && (
        <div className="rounded-card border bg-card px-5 py-4">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">{t("rep2.se.changeHistory")}</h3>
          </div>
          <ul className="mt-3 space-y-2">
            {history.map((h) => {
              const d = diffStandards(config, h.config);
              const changes = d.thresholds.length + d.weights.length;
              const open = openDiff === h.id;
              return (
                <li
                  key={h.id}
                  className="border-b pb-2 text-sm last:border-0 last:pb-0"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                    <div className="flex-1">
                      <p className="text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {h.changedByName ?? t("rep2.se.someone")}
                        </span>{" "}
                        {t("rep2.se.updatedStandard")}
                        {h.reason ? `: “${h.reason}”` : "."}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(h.createdAt).toLocaleString()}
                      </p>
                    </div>
                    {canEdit && (
                      <div className="flex shrink-0 gap-2">
                        <button
                          onClick={() => setOpenDiff(open ? null : h.id)}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          {open
                            ? t("rep2.se.hide")
                            : `${t("rep2.se.viewChangesPrefix")} (${changes})`}
                        </button>
                        <button
                          onClick={() => restoreVersion(h)}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          {t("rep2.se.restore")}
                        </button>
                      </div>
                    )}
                  </div>
                  {open && (
                    <div className="ml-5 mt-2 rounded-input border bg-muted/40 p-3 text-xs">
                      {changes === 0 ? (
                        <p className="text-muted-foreground">
                          {t("rep2.se.identicalToCurrent")}
                        </p>
                      ) : (
                        <>
                          <p className="mb-1 text-muted-foreground">
                            {t("rep2.se.diffIntro")}
                          </p>
                          <ul className="space-y-0.5">
                            {d.thresholds.map((th) => (
                              <li key={`${th.key}-${th.field}`}>
                                <span className="font-medium">{th.label}</span> ·{" "}
                                {th.field === "healthy" ? t("rep2.se.healthy") : t("rep2.se.highRisk")}:{" "}
                                <span className="text-muted-foreground">{th.to}</span> →{" "}
                                <span className="font-semibold">{th.from}</span>
                              </li>
                            ))}
                            {d.weights.map((w) => (
                              <li key={w.dim}>
                                <span className="font-medium">{t("rep2.se.weight")} {w.label}</span>:{" "}
                                <span className="text-muted-foreground">{w.to}%</span> →{" "}
                                <span className="font-semibold">{w.from}%</span>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Barra de acciones */}
      {canEdit && (
        <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-card border bg-card px-4 py-3 shadow-card backdrop-blur">
          <p className="text-sm text-muted-foreground">
            {dirty
              ? t("rep2.se.unsavedChanges")
              : custom
                ? t("rep2.se.usingCustom")
                : t("rep2.se.usingRecommended")}
            {!weightsOk && (
              <span className="ml-1 font-medium text-destructive">
                {t("rep2.se.weightsMust100")}
              </span>
            )}
            {weightsOk && !qualityFloorOk && (
              <span className="ml-1 font-medium text-destructive">
                {t("rep2.se.qualityFloor")}
              </span>
            )}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onRestore}
              disabled={saving || (!custom && !dirty)}
            >
              <RotateCcw className="mr-2 h-4 w-4" /> {t("rep2.se.restoreRecommended")}
            </Button>
            <Button onClick={onSave} disabled={!canSave || saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? t("rep2.se.saving") : t("rep2.se.saveChanges")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-button border px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary text-white"
          : "border-input text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function ThresholdCard({
  def,
  healthy,
  risk,
  invalid,
  canEdit,
  onChange,
  onLocked,
}: {
  def: MetricDef;
  healthy: number;
  risk: number;
  invalid: boolean;
  canEdit: boolean;
  onChange: (key: string, field: "healthy" | "risk", value: number) => void;
  onLocked: () => void;
}) {
  const { t } = useT();
  const dirWord =
    def.direction === "higherIsBetter" ? t("rep2.se.dir.higher") : t("rep2.se.dir.lower");
  return (
    <Card className={invalid ? "border-destructive" : ""}>
      <CardContent className="py-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold">{def.label}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{def.help}</p>
          </div>
          <Badge variant="secondary" className="shrink-0 text-[10px]">
            {t(roleLabelKey[def.role])}
          </Badge>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <ThresholdInput
            label={t("rep2.se.healthy")}
            tone="healthy"
            value={healthy}
            unit={def.unit}
            suffix={dirWord}
            def={def}
            canEdit={canEdit}
            onChange={(v) => onChange(def.key, "healthy", v)}
            onLocked={onLocked}
          />
          <ThresholdInput
            label={t("rep2.se.highRisk")}
            tone="risk"
            value={risk}
            unit={def.unit}
            suffix={def.direction === "higherIsBetter" ? t("rep2.se.dir.lower") : t("rep2.se.dir.higher")}
            def={def}
            canEdit={canEdit}
            onChange={(v) => onChange(def.key, "risk", v)}
            onLocked={onLocked}
          />
        </div>

        {invalid && (
          <p className="mt-2 text-xs font-medium text-destructive">
            {t("rep2.se.thresholdsInvalid")}
          </p>
        )}
        <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {def.action}
        </p>
      </CardContent>
    </Card>
  );
}

function ThresholdInput({
  label,
  tone,
  value,
  unit,
  suffix,
  def,
  canEdit,
  onChange,
  onLocked,
}: {
  label: string;
  tone: "healthy" | "risk";
  value: number;
  unit: string;
  suffix: string;
  def: MetricDef;
  canEdit: boolean;
  onChange: (v: number) => void;
  onLocked: () => void;
}) {
  return (
    <div
      className={cn(
        "rounded-input border p-3",
        tone === "healthy"
          ? "border-success/30 bg-success-soft"
          : "border-danger/30 bg-danger-soft",
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "text-[11px] font-semibold",
            tone === "healthy" ? "text-success" : "text-danger",
          )}
        >
          {label}
        </span>
        {!canEdit && <Lock className="h-3 w-3 text-muted-foreground" />}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <input
          type="number"
          value={value}
          min={def.min}
          max={def.max}
          step={def.step}
          disabled={!canEdit}
          onClick={() => !canEdit && onLocked()}
          onChange={(e) => onChange(Number(e.target.value))}
          className={cn(
            "w-16 rounded-md border bg-card px-2 py-1 text-lg font-bold outline-none focus:ring-2 focus:ring-primary",
            !canEdit && "cursor-pointer opacity-70",
          )}
        />
        <span className="text-sm text-muted-foreground">
          {unit} {suffix}
        </span>
      </div>
    </div>
  );
}

function ScorePanel({
  weights,
  sum,
  ok,
  canEdit,
  onChange,
  onLocked,
}: {
  weights: Record<ScoreDimension, number>;
  sum: number;
  ok: boolean;
  canEdit: boolean;
  onChange: (dim: ScoreDimension, v: number) => void;
  onLocked: () => void;
}) {
  const { t } = useT();
  const dims = Object.keys(DIMENSION_LABEL) as ScoreDimension[];
  return (
    <Card>
      <CardContent className="py-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">{t("rep2.se.scoreComposition")}</h3>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("rep2.se.scoreCompositionDesc")}
        </p>

        <div className="mt-5 space-y-4">
          {dims.map((dim) => (
            <div key={dim} className="flex items-center gap-4">
              <span className="w-32 shrink-0 text-sm font-medium">
                {t(`lib.dimension.${dim}`)}
              </span>
              <input
                type="range"
                min={0}
                max={60}
                step={5}
                value={weights[dim]}
                disabled={!canEdit}
                onChange={(e) => onChange(dim, Number(e.target.value))}
                className="flex-1 accent-[var(--primary)] disabled:opacity-60"
                onClick={() => !canEdit && onLocked()}
              />
              <span className="w-12 text-right text-sm font-semibold tabular-nums">
                {weights[dim]}%
              </span>
            </div>
          ))}
        </div>

        <div
          className={cn(
            "mt-5 flex items-center justify-between rounded-input border p-3 text-sm",
            ok
              ? "border-success/30 bg-success-soft text-success"
              : "border-warning/30 bg-warning-soft text-warning",
          )}
        >
          <span className="font-medium">{t("rep2.se.totalPrefix")} {sum}%</span>
          <span>
            {ok
              ? t("rep2.se.balanced")
              : t("rep2.se.adjustTo100")}
          </span>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          {t("rep2.se.recommendedWeights")}
        </p>
      </CardContent>
    </Card>
  );
}

function ScorePreview({
  preview,
  hasData,
}: {
  preview: ReturnType<typeof scoreWithStandard>;
  hasData: boolean;
}) {
  const { t } = useT();
  const sinDatos = preview.level === "SIN_DATOS";
  const scoreColor = sinDatos
    ? "#94A3B8"
    : (preview.score ?? 0) >= 75
      ? "#16C784"
      : (preview.score ?? 0) >= 60
        ? "#F5A623"
        : "#E5484D";

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="py-5">
        <div className="flex items-center gap-2">
          <Gauge className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">{t("rep2.se.scorePreview")}</h3>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {hasData
            ? t("rep2.se.scorePreviewData")
            : t("rep2.se.scorePreviewNoData")}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold text-white"
              style={{ backgroundColor: scoreColor }}
            >
              {sinDatos ? "—" : preview.score}
            </div>
            <div>
              {sinDatos ? (
                <Badge variant="secondary">{t("rep2.se.insufficientData")}</Badge>
              ) : (
                <Badge
                  variant={levelVariant(
                    preview.level as Exclude<typeof preview.level, "SIN_DATOS">,
                  )}
                >
                  {t(
                    `lib.level.${preview.level as Exclude<typeof preview.level, "SIN_DATOS">}`,
                  )}
                </Badge>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {t("rep2.se.confidencePrefix")} {Math.round(preview.confidence * 100)}%
              </p>
            </div>
          </div>

          {/* Dimensiones */}
          <div className="flex flex-1 flex-wrap gap-2">
            {preview.dimensions.map((d) => (
              <div
                key={d.dim}
                className="rounded-input border bg-card px-3 py-2 text-center"
              >
                <div className="text-sm font-bold">
                  {d.score === null ? "—" : d.score}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {t(`lib.dimension.${d.dim}`)} · {d.weight}%
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Por qué (top razones) */}
        {preview.worst.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-muted-foreground">
              {t("rep2.se.whatCountsAgainst")}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {preview.worst.map((w) => (
                <span
                  key={w.key}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-medium",
                    w.state === "risk"
                      ? "bg-danger-soft text-danger"
                      : "bg-warning-soft text-warning",
                  )}
                >
                  {w.label}: {w.value}
                  {w.unit}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Sin datos + qué integración las habilita */}
        {preview.missing.length > 0 && (
          <div className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div>
              <span className="font-medium">{t("rep2.se.noDataLabel")}</span> {t("rep2.se.noDataDesc")}
              <ul className="mt-1 space-y-0.5">
                {preview.missing.map((x) => {
                  const src = METRIC_DEFS.find((d) => d.key === x.key)?.source;
                  return (
                    <li key={x.key}>
                      · {x.label}
                      {src ? ` — ${src}` : ""}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
