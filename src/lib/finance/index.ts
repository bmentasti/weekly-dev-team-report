// Motor de control financiero — Budget, Forecast & Profitability.
// Servicio centralizado y testeable (§8). Las fórmulas viven acá, NUNCA en los
// componentes visuales. Barrel de exports público del módulo.

export * from "./types";
export * from "./money";
export * from "./progress";
export * from "./budget";
export * from "./labor";
export * from "./evm";
export * from "./profitability";
export * from "./early-completion";
export * from "./delay";
export * from "./status";
export * from "./risks";
export * from "./engine";
export * from "./scenarios";
export * from "./alerts";
// NOTA: load.ts y access.ts NO se re-exportan acá porque dependen de Prisma
// (server-only); impórtalos directamente desde "@/lib/finance/load".
