"use client";

/**
 * Tema de gráficos DevMetrics para recharts.
 * Paleta de marca + chrome moderno (tooltip con sombra, grilla sutil,
 * ejes limpios, leyenda en chips, gradientes reutilizables).
 */

// Paleta de marca (brand guide).
export const CHART = {
  navy: "#0B1D3A",
  blue: "#2563FF",
  blueSoft: "#7AA2FF",
  green: "#16C784",
  amber: "#F5A623",
  red: "#E5484D",
  gray: "#94A3B8",
  grid: "#EEF2F8",
  axis: "#94A3B8",
  track: "#E6EBF2",
} as const;

// Series semánticas consistentes en toda la app.
export const SERIES = {
  velocity: CHART.blue,
  done: CHART.green,
  merged: CHART.navy,
  inProgress: CHART.blueSoft,
  blocked: CHART.red,
  throughput: CHART.blue,
  completedPoints: CHART.navy,
  todo: CHART.gray,
} as const;

export const axisProps = {
  stroke: CHART.axis,
  tick: { fill: CHART.axis, fontSize: 12 },
  tickLine: false,
  axisLine: false,
} as const;

export const gridProps = {
  stroke: CHART.grid,
  strokeDasharray: "0",
  vertical: false,
} as const;

// Tooltip moderno (rounded-card + shadow + borde suave).
interface TipItem {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
}
export function ChartTooltip({
  active,
  payload,
  label,
  suffix = "",
}: {
  active?: boolean;
  payload?: TipItem[];
  label?: string | number;
  suffix?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-input border border-border bg-white/95 px-3 py-2 shadow-card backdrop-blur">
      {label !== undefined && label !== "" && (
        <p className="mb-1 text-xs font-semibold text-navy">{label}</p>
      )}
      <div className="space-y-0.5">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: p.color }}
            />
            <span className="text-muted-foreground">{p.name}</span>
            <span className="ml-auto font-semibold tabular-nums text-foreground">
              {p.value}
              {suffix}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Leyenda en chips (reemplaza la leyenda por defecto de recharts).
export function ChartLegend({
  items,
}: {
  items: { label: string; color: string }[];
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
      {items.map((it) => (
        <span
          key={it.label}
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: it.color }}
          />
          {it.label}
        </span>
      ))}
    </div>
  );
}

// Defs de gradiente vertical para áreas/barras. Usar dentro de <defs>.
export function gradientId(key: string) {
  return `dm-grad-${key}`;
}
export function LinearGradient({
  id,
  color,
  from = 0.28,
  to = 0,
}: {
  id: string;
  color: string;
  from?: number;
  to?: number;
}) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={color} stopOpacity={from} />
      <stop offset="100%" stopColor={color} stopOpacity={to} />
    </linearGradient>
  );
}
