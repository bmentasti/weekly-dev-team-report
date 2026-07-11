// DevMetrics Intelligence Engine — tipos base (Etapa 1).
// Capa pura, sin dependencias de Prisma/Next: se calcula a partir de las
// integraciones ya existentes y es 100% testeable en aislamiento.

export type CoverageLevel =
  | "INSUFICIENTE"
  | "INICIAL"
  | "BASICO"
  | "AVANZADO"
  | "INTEGRAL";

export type ConfidenceBand =
  | "INSUFICIENTE"
  | "BAJO"
  | "MEDIO"
  | "ALTO"
  | "MUY_ALTO";

export const COVERAGE_LEVEL_LABELS: Record<CoverageLevel, string> = {
  INSUFICIENTE: "Insuficiente",
  INICIAL: "Inicial",
  BASICO: "Básico",
  AVANZADO: "Avanzado",
  INTEGRAL: "Integral",
};

export const CONFIDENCE_BAND_LABELS: Record<ConfidenceBand, string> = {
  INSUFICIENTE: "Insuficiente",
  BAJO: "Bajo",
  MEDIO: "Medio",
  ALTO: "Alto",
  MUY_ALTO: "Muy alto",
};

/** Una integración tal como la ve el motor (derivada del modelo Integration). */
export interface ConnectedSource {
  /** ProviderSlug, ej. "jira", "github". */
  slug: string;
  label: string;
  status: "CONNECTED" | "DISCONNECTED" | "ERROR";
  /** Última sincronización (Integration.updatedAt). null si nunca. */
  lastSyncAt: Date | null;
}

/** Resultado de cobertura para una dimensión del proyecto. */
export interface DimensionCoverage {
  key: string;
  label: string;
  coverage: number; // 0..100
  level: CoverageLevel;
  confidence: ConfidenceBand;
  sources: string[]; // labels de fuentes conectadas que la alimentan
  sourceCount: number;
  freshnessDays: number | null; // días desde el sync más reciente
  missing: string[];
  recommended: string[]; // integraciones sugeridas para cubrirla
  impact: string; // qué no se puede afirmar sin esta dimensión
}

export interface CoverageReport {
  overall: number; // 0..100
  level: CoverageLevel;
  connectedCount: number;
  categoriesCovered: number; // dimensiones con coverage > 0
  totalDimensions: number;
  dimensions: DimensionCoverage[];
}
