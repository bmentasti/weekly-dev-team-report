import type { ProviderAdapter } from "../types";
import { modelFor, testAiKey, type AiType } from "@/lib/reports/ai";

// Adapters de proveedores de IA. No aportan work items / PRs / actividad: se
// usan en la generación del reporte para el análisis. testConnection valida la
// API key; fetchData no devuelve nada.

function makeAiAdapter(slug: ProviderAdapter["slug"], type: AiType): ProviderAdapter {
  return {
    slug,
    async testConnection(ctx) {
      if (!ctx.secret.trim())
        return { ok: false, error: "Ingresá la API key." };
      const r = await testAiKey(type, ctx.secret, modelFor(type, ctx.config));
      return r.ok ? { ok: true, detail: "IA conectada" } : { ok: false, error: r.error };
    },
    async fetchData() {
      return {};
    },
  };
}

export const anthropicAdapter = makeAiAdapter("anthropic", "ANTHROPIC");
export const openaiAdapter = makeAiAdapter("openai", "OPENAI");
export const geminiAdapter = makeAiAdapter("gemini", "GEMINI");
export const copilotAdapter = makeAiAdapter("copilot", "COPILOT");
