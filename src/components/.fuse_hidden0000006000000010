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
  CATEGORY_LABEL,
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
import { LEVEL_LABEL, levelVariant } from "@/lib/reports/score";
import type { ReportMetrics } from "@/lib/reports/types";

const CATEGORY_TABS: MetricCategory[] = [
  "delivery",
  "quality",
  "product",
  "team",
];
type Tab = MetricCategory | "score";

const roleLabel: Record<string, string> = {
  TL: "Tech Lead",
  PO: "Product Owner",
  DIR: "Dirección",
  TODOS: "Todos",
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
      feature: "Personalizar los umbrales de salud",
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
        title: "Poco histórico",
        description:
          "Necesitás al menos 2 reportes con datos para sugerir umbrales según el ritmo del equipo.",
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
        title: "Motivo del cambio",
        label:
          "Estás aflojando estándares respecto al recomendado. Dejá un motivo (queda en el historial).",
        placeholder: "Ej: equipo nuevo, primeros 3 sprints",
        confirmLabel: "Guardar",
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
          title: "No se pudo guardar",
          description: data.error ?? "Intentá de nuevo.",
        });
        return;
      }
      await dialogs.alert({
        title: "Estándar guardado",
        description:
          "Los nuevos reportes se evaluarán con estos umbrales. Podés restaurar los recomendados cuando quieras.",
      });
      await load(scope); // refresca historial + estado
    } finally {
      setSaving(false);
    }
  }

  async function onRestore() {
    const ok = await dialogs.confirm({
      title: "Restaurar valores recomendados",
      description:
        scope === "project"
          ? "Se descartará el override de este proyecto y volverá a heredar el estándar del workspace."
          : "Se descartará tu estándar personalizado y volverás a los umbrales base de DevMetrics.",
      confirmLabel: "Restaurar",
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
              Umbrales de salud
            </h1>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Definí con qué parámetros DevMetrics evalúa si un sprint está
            saludable, en observación o en riesgo. El objetivo no es exigir de
            más, sino adaptar el análisis a la realidad de cada equipo.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={canEdit ? "success" : "secondary"}>Plan {planName}</Badge>
          <Badge variant={custom ? "info" : "outline"}>
            {custom ? "Estándar personalizado" : "Estándar recomendado"}
          </Badge>
        </div>
      </div>

      {/* Alcance del estándar (workspace vs proyecto, con herencia) */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Aplica a:</span>
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
              ? "Workspace"
              : projectName
                ? `Proyecto: ${projectName}`
                : "Proyecto actual"}
          </button>
        ))}
        {scope === "project" && (
          <span className="text-xs text-muted-foreground">
            {custom
              ? "Este proyecto tiene su propio override."
              : "Heredando el estándar del workspace (sin override propio)."}
            {" "}Los estándares por proyecto son parte del plan Pro.
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
                    ? "Estás viendo el estándar heredado del workspace"
                    : "Estás viendo los estándares recomendados"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {scope === "project"
                    ? "Definir umbrales propios por proyecto está disponible en el plan Pro. El proyecto usa, por ahora, el estándar del workspace."
                    : "Usás los umbrales base de DevMetrics para analizar tus reportes. Personalizarlos por equipo o contexto está disponible en Team y Pro."}
                </p>
              </div>
            </div>
            <Button asChild className="shrink-0">
              <Link href="/settings">Desbloquear personalización</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Aviso persistencia (falta db:push) */}
      {canEdit && !persistenceReady && (
        <div className="flex items-start gap-2 rounded-input border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            La tabla de estándares todavía no está en la base. Para guardar
            cambios, ejecutá <code>npm run db:push</code> y reiniciá el server.
          </span>
        </div>
      )}

      {/* Vista previa del score (config -> score real) */}
      <ScorePreview preview={preview} hasData={!!previewMetrics} />

      {/* Perfiles predefinidos */}
      {canEdit && (
        <div className="rounded-card border bg-white px-5 py-4">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Perfiles predefinidos</h3>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Cargá un estándar pensado para tu tipo de equipo y ajustalo desde ahí.
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
                Sugerir según mi histórico
              </Button>
              <span className="text-xs text-muted-foreground">
                Ajusta los umbrales al ritmo real del equipo (últimos {recentMetrics.length || "—"} reportes). Revisá y guardá.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {CATEGORY_TABS.map((c) => (
          <TabButton key={c} active={tab === c} onClick={() => setTab(c)}>
            {CATEGORY_LABEL[c]}
          </TabButton>
        ))}
        <TabButton active={tab === "score"} onClick={() => setTab("score")}>
          Score de salud
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
        <div className="rounded-card border bg-white px-5 py-4">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Historial de cambios</h3>
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
                          {h.changedByName ?? "Alguien"}
                        </span>{" "}
                        actualizó el estándar
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
                            ? "Ocultar"
                            : `Ver cambios (${changes})`}
                        </button>
                        <button
                          onClick={() => restoreVersion(h)}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          Restaurar
                        </button>
                      </div>
                    )}
                  </div>
                  {open && (
                    <div className="ml-5 mt-2 rounded-input border bg-muted/40 p-3 text-xs">
                      {changes === 0 ? (
                        <p className="text-muted-foreground">
                          Idéntico a la configuración actual.
                        </p>
                      ) : (
                        <>
                          <p className="mb-1 text-muted-foreground">
                            Diferencias respecto a lo que tenés cargado ahora
                            (restaurar dejaría estos valores):
                          </p>
                          <ul className="space-y-0.5">
                            {d.thresholds.map((t) => (
                              <li key={`${t.key}-${t.field}`}>
                                <span className="font-medium">{t.label}</span> ·{" "}
                                {t.field === "healthy" ? "Saludable" : "Alto riesgo"}:{" "}
                                <span className="text-muted-foreground">{t.to}</span> →{" "}
                                <span className="font-semibold">{t.from}</span>
                              </li>
                            ))}
                            {d.weights.map((w) => (
                              <li key={w.dim}>
                                <span className="font-medium">Peso {w.label}</span>:{" "}
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
        <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-card border bg-white/95 px-4 py-3 shadow-card backdrop-blur">
          <p className="text-sm text-muted-foreground">
            {dirty
              ? "Tenés cambios sin guardar."
              : custom
                ? "Estás usando tu estándar personalizado."
                : "Estás usando el estándar recomendado."}
            {!weightsOk && (
              <span className="ml-1 font-medium text-destructive">
                Los pesos del score deben sumar 100%.
              </span>
            )}
            {weightsOk && !qualityFloorOk && (
              <span className="ml-1 font-medium text-destructive">
                Calidad técnica no puede quedar por debajo de 5%: un estándar así
                infla el score y oculta riesgos.
              </span>
            )}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onRestore}
              disabled={saving || (!custom && !dirty)}
            >
              <RotateCcw className="mr-2 h-4 w-4" /> Restaurar recomendados
            </Button>
            <Button onClick={onSave} disabled={!canSave || saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Guardando…" : "Guardar cambios"}
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
  const dirWord =
    def.direction === "higherIsBetter" ? "o más" : "o menos";
  return (
    <Card className={invalid ? "border-destructive" : ""}>
      <CardContent className="py-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold">{def.label}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{def.help}</p>
          </div>
          <Badge variant="secondary" className="shrink-0 text-[10px]">
            {roleLabel[def.role]}
          </Badge>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <ThresholdInput
            label="Saludable"
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
            label="Alto riesgo"
            tone="risk"
            value={risk}
            unit={def.unit}
            suffix={def.direction === "higherIsBetter" ? "o menos" : "o más"}
            def={def}
            canEdit={canEdit}
            onChange={(v) => onChange(def.key, "risk", v)}
            onLocked={onLocked}
          />
        </div>

        {invalid && (
          <p className="mt-2 text-xs font-medium text-destructive">
            Revisá los umbrales: no son coherentes con la dirección de la métrica.
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
          ? "border-emerald-200 bg-emerald-50/50"
          : "border-red-200 bg-red-50/40",
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "text-[11px] font-semibold",
            tone === "healthy" ? "text-emerald-700" : "text-red-700",
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
            "w-16 rounded-md border bg-white px-2 py-1 text-lg font-bold outline-none focus:ring-2 focus:ring-primary",
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
  const dims = Object.keys(DIMENSION_LABEL) as ScoreDimension[];
  return (
    <Card>
      <CardContent className="py-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Composición del score de salud</h3>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          El score (0–100) pondera estas dimensiones. Ajustá los pesos según qué
          prioriza tu organización. Deben sumar 100%.
        </p>

        <div className="mt-5 space-y-4">
          {dims.map((dim) => (
            <div key={dim} className="flex items-center gap-4">
              <span className="w-32 shrink-0 text-sm font-medium">
                {DIMENSION_LABEL[dim]}
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
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-amber-200 bg-amber-50 text-amber-800",
          )}
        >
          <span className="font-medium">Total: {sum}%</span>
          <span>
            {ok
              ? "Balanceado."
              : "Ajustá los pesos hasta llegar a 100% para poder guardar."}
          </span>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Recomendado por DevMetrics: Delivery 30 · Calidad 25 · Producto 20 ·
          Equipo 15 · Riesgo 10.
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
          <h3 className="font-semibold">Vista previa del score</h3>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {hasData
            ? "Así quedaría tu último reporte con estos umbrales y pesos. Cambiá algo arriba y se recalcula al instante."
            : "Generá un reporte para ver el impacto real de estos umbrales."}
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
                <Badge variant="secondary">Sin datos suficientes</Badge>
              ) : (
                <Badge
                  variant={levelVariant(
                    preview.level as Exclude<typeof preview.level, "SIN_DATOS">,
                  )}
                >
                  {
                    LEVEL_LABEL[
                      preview.level as Exclude<typeof preview.level, "SIN_DATOS">
                    ]
                  }
                </Badge>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                Confianza {Math.round(preview.confidence * 100)}%
              </p>
            </div>
          </div>

          {/* Dimensiones */}
          <div className="flex flex-1 flex-wrap gap-2">
            {preview.dimensions.map((d) => (
              <div
                key={d.dim}
                className="rounded-input border bg-white px-3 py-2 text-center"
              >
                <div className="text-sm font-bold">
                  {d.score === null ? "—" : d.score}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {DIMENSION_LABEL[d.dim]} · {d.weight}%
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Por qué (top razones) */}
        {preview.worst.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-muted-foreground">
              Qué pesa en contra
            </p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {preview.worst.map((w) => (
                <span
                  key={w.key}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-medium",
                    w.state === "risk"
                      ? "bg-red-100 text-red-700"
                      : "bg-amber-100 text-amber-800",
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
              <span className="font-medium">Sin datos</span> (no puntúan; conectá
              la fuente para incluirlas):
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
