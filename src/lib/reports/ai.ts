import type { ReportMetrics } from "./types";

// AI analysis. Soporta Anthropic (Claude), OpenAI (ChatGPT), Google (Gemini) y
// GitHub Copilot/Models (endpoint OpenAI-compatible). Cada uno usa su API key.

export type AiType = "OPENAI" | "ANTHROPIC" | "GEMINI" | "COPILOT";

const DEFAULT_MODEL: Record<AiType, string> = {
  ANTHROPIC: "claude-3-5-sonnet-latest",
  OPENAI: "gpt-4o-mini",
  GEMINI: "gemini-1.5-flash",
  COPILOT: "gpt-4o-mini",
};

interface CallResult {
  ok: boolean;
  text?: string;
  error?: string;
}

async function callAi(
  type: AiType,
  apiKey: string,
  model: string,
  system: string,
  user: string,
  maxTokens = 700,
): Promise<CallResult> {
  try {
    if (type === "ANTHROPIC") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system,
          messages: [{ role: "user", content: user }],
        }),
      });
      if (!res.ok) return { ok: false, error: `Anthropic ${res.status}` };
      const data = (await res.json()) as {
        content?: { text?: string }[];
      };
      return { ok: true, text: data.content?.[0]?.text ?? "" };
    }

    if (type === "GEMINI") {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${system}\n\n${user}` }] }],
          }),
        },
      );
      if (!res.ok) return { ok: false, error: `Gemini ${res.status}` };
      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      return {
        ok: true,
        text: data.candidates?.[0]?.content?.parts?.[0]?.text ?? "",
      };
    }

    // OpenAI / Copilot (GitHub Models) — OpenAI-compatible chat/completions.
    const endpoint =
      type === "COPILOT"
        ? "https://models.inference.ai.azure.com/chat/completions"
        : "https://api.openai.com/v1/chat/completions";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) return { ok: false, error: `${type} ${res.status}` };
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return { ok: true, text: data.choices?.[0]?.message?.content ?? "" };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error de red con la IA.",
    };
  }
}

export function modelFor(type: AiType, config: Record<string, string>): string {
  return config.model?.trim() || DEFAULT_MODEL[type];
}

/** Valida la API key con una llamada mínima. */
export async function testAiKey(
  type: AiType,
  apiKey: string,
  model: string,
): Promise<{ ok: boolean; error?: string }> {
  const r = await callAi(
    type,
    apiKey,
    model,
    "Respondé solo 'ok'.",
    "ping",
    5,
  );
  if (r.ok) return { ok: true };
  return {
    ok: false,
    error:
      r.error?.includes("401") || r.error?.includes("403")
        ? "API key inválida o sin permisos."
        : r.error ?? "No se pudo validar la IA.",
  };
}

/** Genera un análisis ejecutivo del reporte con la IA elegida. */
export async function generateAiAnalysis(
  type: AiType,
  apiKey: string,
  model: string,
  metrics: ReportMetrics,
  summary: string,
  healthStatus: string,
  locale: "es" | "en" = "es",
): Promise<string | null> {
  const system =
    locale === "en"
      ? "You are a senior engineering analyst. You write in English — clear, concise and actionable — for a tech leader. You do not make up data: you rely only on the provided metrics."
      : "Sos un analista de ingeniería senior. Escribís en español, claro, conciso y accionable, para un líder técnico. No inventás datos: te basás solo en las métricas provistas.";
  const user =
    locale === "en"
      ? `Analyze this sprint report and return, in short bulleted sections:
1) Executive read (2-3 sentences).
2) Interpreted risks (why they matter).
3) 3 concrete recommendations.
4) Focus for the next sprint.

Health status: ${healthStatus}.
Automatic summary: ${summary}
Metrics (JSON): ${JSON.stringify(metrics)}`
      : `Analizá este reporte de sprint y devolvé, en secciones cortas con viñetas:
1) Lectura ejecutiva (2-3 frases).
2) Riesgos interpretados (por qué importan).
3) 3 recomendaciones concretas.
4) Foco para el próximo sprint.

Estado de salud: ${healthStatus}.
Resumen automático: ${summary}
Métricas (JSON): ${JSON.stringify(metrics)}`;

  const r = await callAi(type, apiKey, model, system, user, 900);
  return r.ok ? (r.text ?? null) : null;
}

export function isAiDemo(config: Record<string, string>): boolean {
  return config.demo === "true";
}

/** Análisis "demo" (sin llamar a la API): armado con las métricas reales. */
export function demoAiAnalysis(
  metrics: ReportMetrics,
  healthStatus: string,
): string {
  const wi = metrics.workItems;
  const cc = metrics.codeChanges;
  const cap = metrics.capacity;
  const support = metrics.people.filter((p) => p.category === "SUPPORT");
  const overloaded = metrics.people.filter((p) => p.category === "OVERLOADED");
  const healthLabel =
    healthStatus === "HEALTHY"
      ? "saludable"
      : healthStatus === "MEDIUM_RISK"
        ? "con riesgo medio"
        : "con riesgo alto";

  return [
    "Lectura ejecutiva",
    `• El equipo completó ${cap.completedPoints} de ${cap.committedPoints} story points (${metrics.projectProgress.completionByPoints}%) y mergeó ${cc.merged} PR/MR. El estado general es ${healthLabel}.`,
    "",
    "Riesgos interpretados",
    `• ${wi.blocked} tarea(s) bloqueada(s) y ${wi.stale} sin movimiento pueden frenar el cierre del sprint.`,
    `• ${cc.old} PR/MR llevan más de 72h abiertos y ${cc.withoutReviewer} no tienen reviewer: el trabajo terminado no se está integrando.`,
    "",
    "Recomendaciones",
    "• Destrabar bloqueos y confirmar vigencia de lo que no tuvo movimiento en la daily.",
    "• Asignar reviewers y priorizar el merge de los PR/MR viejos.",
    overloaded.length
      ? `• Balancear carga: ${overloaded.map((p) => p.name).join(", ")} con WIP alto.`
      : "• Mantener el balance de carga actual.",
    "",
    "Foco para el próximo sprint",
    support.length
      ? `• Acompañar a ${support.map((p) => p.name).join(", ")} para destrabar y sostener el ritmo.`
      : "• Sostener el ritmo y cerrar el carry-over pendiente.",
  ].join("\n");
}

export function demoAiAnswer(question: string, summary: string): string {
  return `(Modo demo) Según los datos del reporte: ${summary}\n\nSobre "${question}": priorizá destrabar los bloqueos y asignar reviewers a los PR/MR pendientes; eso es lo que más mueve la aguja del avance en este período. Conectá tu API key de Claude para respuestas completas.`;
}

/**
 * Responde una pregunta del usuario usando SOLO los datos del reporte.
 */
export async function askReport(
  type: AiType,
  apiKey: string,
  model: string,
  reportContext: string,
  question: string,
): Promise<CallResult> {
  const system =
    "Sos un analista de ingeniería. Respondé SOLO con la información del reporte que se te da a continuación. Si la respuesta no está en esos datos, decí claramente que no hay información suficiente en el reporte. Español, conciso y orientado a acciones concretas.";
  const user = `Datos del reporte:\n${reportContext}\n\nPregunta: ${question}`;
  return callAi(type, apiKey, model, system, user, 700);
}
