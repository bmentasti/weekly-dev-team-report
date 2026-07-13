"use client";

// DevMetrics — fundamento de visualización (Etapa 1 del rediseño visual).
// Tokens de color por categoría/serie, sistema de estados accesible (color +
// ícono + forma + etiqueta) y componentes base de dataviz en SVG.
// Reutiliza los tokens existentes (var(--primary), var(--success), etc.).
import {
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Ban,
  CircleDashed,
  Clock,
  MinusCircle,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n-provider";

// --- Paleta por categoría (significado consistente) ------------------------
export const CATEGORY_COLORS: Record<string, string> = {
  planning: "#2563ff", // azul
  code: "#7c3aed", // violeta
  quality: "#06b6d4", // turquesa
  testing: "#0d9488", // verde azulado
  security: "#be185d", // magenta
  cicd: "#ea580c", // naranja
  production: "#4f46e5", // índigo
  incidents: "#f43f5e", // coral
  capacity: "#ca8a04", // amarillo oscuro
  cost: "#16a34a", // verde
  risk: "#f43f5e", // coral
  documentation: "#64748b", // gris
  delivery: "#2563ff",
};

// Serie categórica de alto contraste (mínimo de colores por gráfico).
export const CHART_SERIES = [
  "#2563ff",
  "#7c3aed",
  "#06b6d4",
  "#16a34a",
  "#ea580c",
  "#e5484d",
  "#ca8a04",
  "#0d9488",
];

// --- Sistema de estados de salud (no depende solo del color) ---------------
export type VizStatus =
  | "healthy"
  | "attention"
  | "risk"
  | "critical"
  | "no-data"
  | "partial"
  | "stale";

export interface StatusToken {
  label: string;
  color: string;
  icon: LucideIcon;
  description: string;
}

export const STATUS_SYSTEM: Record<VizStatus, StatusToken> = {
  healthy: { label: "Saludable", color: "#16c784", icon: CheckCircle2, description: "Dentro de lo esperado." },
  attention: { label: "Atención", color: "#f5a524", icon: AlertTriangle, description: "Requiere seguimiento." },
  risk: { label: "Riesgo", color: "#f76808", icon: AlertOctagon, description: "En riesgo; requiere acción." },
  critical: { label: "Crítico", color: "#e5484d", icon: Ban, description: "Acción inmediata." },
  "no-data": { label: "Sin datos", color: "#94a3b8", icon: CircleDashed, description: "No hay fuente conectada." },
  partial: { label: "Datos parciales", color: "#3b82f6", icon: MinusCircle, description: "Cobertura limitada." },
  stale: { label: "Desactualizado", color: "#8b5cf6", icon: Clock, description: "Datos con retraso." },
};

// Claves i18n por estado (para traducir label/description sin mutar STATUS_SYSTEM).
const STATUS_LABEL_KEY: Record<VizStatus, string> = {
  healthy: "rep2.viz.status.healthy",
  attention: "rep2.viz.status.attention",
  risk: "rep2.viz.status.risk",
  critical: "rep2.viz.status.critical",
  "no-data": "rep2.viz.status.noData",
  partial: "rep2.viz.status.partial",
  stale: "rep2.viz.status.stale",
};

/** Mapea un score 0..100 (o null) a un estado visual. */
export function statusFromScore(score: number | null): VizStatus {
  if (score === null) return "no-data";
  if (score >= 80) return "healthy";
  if (score >= 60) return "attention";
  if (score >= 40) return "risk";
  return "critical";
}

// --- Primitivas ------------------------------------------------------------

export function TrendIndicator({
  delta,
  suffix = "",
}: {
  delta: number;
  suffix?: string;
}) {
  const up = delta > 0;
  const flat = delta === 0;
  const Icon = flat ? ArrowRight : up ? ArrowUpRight : ArrowDownRight;
  const color = flat ? "text-muted-foreground" : up ? "text-success" : "text-destructive";
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-sm font-medium", color)}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      <span>
        {up ? "+" : ""}
        {delta}
        {suffix}
      </span>
    </span>
  );
}

const INTENT_STYLE: Record<
  "info" | "success" | "warning" | "danger",
  { border: string; icon: LucideIcon; color: string }
> = {
  info: { border: "border-l-primary", icon: MinusCircle, color: "text-primary" },
  success: { border: "border-l-success", icon: CheckCircle2, color: "text-success" },
  warning: { border: "border-l-warning", icon: AlertTriangle, color: "text-warning" },
  danger: { border: "border-l-destructive", icon: AlertOctagon, color: "text-destructive" },
};

export function InsightCallout({
  intent = "info",
  title,
  children,
}: {
  intent?: "info" | "success" | "warning" | "danger";
  title: string;
  children?: React.ReactNode;
}) {
  const s = INTENT_STYLE[intent];
  const Icon = s.icon;
  return (
    <div className={cn("flex gap-3 rounded-card border border-l-4 bg-card p-4 shadow-soft", s.border)}>
      <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", s.color)} aria-hidden />
      <div>
        <p className="text-sm font-semibold">{title}</p>
        {children && <p className="mt-0.5 text-sm text-muted-foreground">{children}</p>}
      </div>
    </div>
  );
}

export function EmptyVisualizationState({
  title,
  reason,
  recommended,
}: {
  title: string;
  reason: string;
  recommended?: string[];
}) {
  const { t } = useT();
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-dashed bg-muted/30 px-6 py-10 text-center">
      <CircleDashed className="mb-2 h-8 w-8 text-muted-foreground" aria-hidden />
      <p className="font-semibold">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{reason}</p>
      {recommended && recommended.length > 0 && (
        <p className="mt-2 text-sm">
          <span className="font-medium text-foreground">{t("rep2.viz.connect")}</span> {recommended.join(", ")}
        </p>
      )}
    </div>
  );
}

// --- HealthRing (gauge global) ---------------------------------------------

export function HealthRing({
  score,
  size = 120,
  label,
}: {
  score: number | null;
  size?: number;
  label?: string;
}) {
  const { t } = useT();
  const r = 52;
  const c = 2 * Math.PI * r;
  const pct = score === null ? 0 : Math.max(0, Math.min(100, score)) / 100;
  const status = statusFromScore(score);
  const color = STATUS_SYSTEM[status].color;
  const statusLabel = t(STATUS_LABEL_KEY[status]);
  const resolvedLabel = label ?? t("rep2.viz.health");
  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${resolvedLabel}: ${score === null ? t("rep2.viz.noData") : score + " " + t("rep2.viz.ofHundred")} (${statusLabel})`}
    >
      <svg viewBox="0 0 120 120" width={size} height={size}>
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--muted)" strokeWidth="10" />
        {score !== null && (
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${c * pct} ${c}`}
            transform="rotate(-90 60 60)"
            className="motion-safe:transition-[stroke-dasharray] motion-safe:duration-700"
          />
        )}
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold tabular-nums" style={{ color }}>
          {score ?? "—"}
        </span>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{resolvedLabel}</span>
      </div>
    </div>
  );
}

// --- ProjectHealthMap (rueda de dimensiones) -------------------------------

export interface HealthMapDim {
  key: string;
  label: string;
  score: number | null;
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const p = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  };
  const [x1, y1] = p(startDeg);
  const [x2, y2] = p(endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

export function ProjectHealthMap({
  overall,
  dimensions,
  size = 260,
}: {
  overall: number | null;
  dimensions: HealthMapDim[];
  size?: number;
}) {
  const { t } = useT();
  const cx = 130;
  const cy = 130;
  const r = 104;
  const n = dimensions.length || 1;
  const gap = 3; // grados
  const seg = 360 / n;
  const status = statusFromScore(overall);

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 260 260" width={size} height={size} role="img" aria-label={t("rep2.viz.healthMapAria")}>
        {dimensions.map((d, i) => {
          const start = i * seg + gap / 2;
          const end = (i + 1) * seg - gap / 2;
          const st = statusFromScore(d.score);
          const color = STATUS_SYSTEM[st].color;
          return (
            <path
              key={d.key}
              d={arcPath(cx, cy, r, start, end)}
              fill="none"
              stroke={color}
              strokeWidth={d.score === null ? 8 : 8 + (d.score / 100) * 12}
              strokeLinecap="round"
              opacity={d.score === null ? 0.4 : 1}
            >
              <title>
                {d.label}: {d.score === null ? t("rep2.viz.noData") : `${d.score}/100`}
              </title>
            </path>
          );
        })}
        <circle cx={cx} cy={cy} r="66" fill="var(--card)" stroke="var(--border)" />
        <text x={cx} y={cy - 4} textAnchor="middle" className="fill-current" style={{ fontSize: 34, fontWeight: 800, fill: STATUS_SYSTEM[status].color }}>
          {overall ?? "—"}
        </text>
        <text x={cx} y={cy + 18} textAnchor="middle" style={{ fontSize: 11, fill: "var(--muted-foreground)" }}>
          {t("rep2.viz.health")} · {t(STATUS_LABEL_KEY[status])}
        </text>
      </svg>
      {/* Alternativa textual accesible + leyenda */}
      <ul className="mt-3 grid w-full grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
        {dimensions.map((d) => {
          const st = statusFromScore(d.score);
          const S = STATUS_SYSTEM[st];
          const Icon = S.icon;
          return (
            <li key={d.key} className="flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: S.color }} aria-hidden />
              <span className="truncate">{d.label}</span>
              <span className="ml-auto tabular-nums text-muted-foreground">
                {d.score === null ? "—" : d.score}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
