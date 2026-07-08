import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      // Alcance: la capa de lógica pura (sin React, Prisma, next/*, server-only).
      // UI, páginas RSC y rutas de API se cubren con integración/e2e (fuera del
      // unit coverage) porque requieren mockear el framework y no dan métrica útil.
      include: [
        "src/lib/utils.ts",
        "src/lib/plans.ts",
        "src/lib/permissions.ts",
        "src/lib/validations.ts",
        "src/lib/encryption.ts",
        "src/lib/reports/score.ts",
        "src/lib/reports/standards.ts",
        "src/lib/reports/alert-rules.ts",
        "src/lib/reports/compare.ts",
        "src/lib/reports/people-profile.ts",
        "src/lib/reports/matrix.ts",
        "src/lib/reports/health.ts",
        "src/lib/reports/labels.ts",
        "src/lib/integrations/blocker.ts",
        "src/lib/integrations/connect-helpers.ts",
      ],
      thresholds: {
        statements: 100,
        branches: 95,
        functions: 100,
        lines: 100,
      },
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
