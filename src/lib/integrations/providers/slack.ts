import type { ActivitySignal, ProviderAdapter } from "../types";
import { demoDataFor, isDemo } from "../demo";

// Slack adapter — reads recent messages from a channel and flags likely blockers.
// Uses a Bot User OAuth Token (xoxb-...) with channels:history / channels:read.

const BLOCKER_PATTERN =
  /\b(blocker|blocked|bloque|bloquead|stuck|trab(a|á)d|impedi|no puedo avanzar|can'?t proceed|waiting on|esperando a)\b/i;

async function slackFetch(
  method: string,
  token: string,
  params: Record<string, string>,
): Promise<Record<string, unknown>> {
  const url = `https://slack.com/api/${method}?${new URLSearchParams(params).toString()}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return (await res.json()) as Record<string, unknown>;
}

export const slackAdapter: ProviderAdapter = {
  slug: "slack",
  async testConnection(ctx) {
    if (isDemo(ctx.config)) return { ok: true, detail: "Modo demo" };
    try {
      const auth = await slackFetch("auth.test", ctx.secret, {});
      if (!auth.ok) {
        return {
          ok: false,
          error:
            auth.error === "invalid_auth" || auth.error === "not_authed"
              ? "Token de Slack inválido."
              : `Slack: ${String(auth.error ?? "error")}`,
        };
      }
      const channelId = ctx.config.channelId ?? "";
      const info = await slackFetch("conversations.info", ctx.secret, {
        channel: channelId,
      });
      if (!info.ok) {
        return {
          ok: false,
          error:
            info.error === "channel_not_found"
              ? "No se encontró el canal (revisá el Channel ID)."
              : info.error === "not_in_channel"
                ? "El bot no está en el canal. Invitalo con /invite @tu-app."
                : `Slack: ${String(info.error ?? "error")}`,
        };
      }
      const channel = info.channel as { name?: string } | undefined;
      const team = auth.team as string | undefined;
      return {
        ok: true,
        detail: `Canal #${channel?.name ?? channelId} en ${team ?? "Slack"}`,
      };
    } catch (err) {
      return {
        ok: false,
        error:
          err instanceof Error
            ? `Error de red con Slack: ${err.message}`
            : "Error desconocido con Slack.",
      };
    }
  },

  async fetchData(ctx, opts) {
    if (isDemo(ctx.config)) return demoDataFor("slack");
    const channelId = ctx.config.channelId ?? "";
    const params: Record<string, string> = { channel: channelId, limit: "100" };
    if (opts?.since) {
      params.oldest = String(Math.floor(new Date(opts.since).getTime() / 1000));
    }
    const res = await slackFetch("conversations.history", ctx.secret, params);
    if (!res.ok) {
      throw new Error(`Slack: ${String(res.error ?? "error")}`);
    }
    const messages = (res.messages as Array<Record<string, unknown>>) ?? [];
    const activity: ActivitySignal[] = messages
      .filter((m) => (m.type ?? "message") === "message" && m.subtype == null)
      .map((m) => {
        const ts = String(m.ts ?? "");
        const text = String(m.text ?? "");
        return {
          source: "slack" as const,
          externalId: ts,
          author: (m.user as string) ?? (m.username as string) ?? null,
          channel: channelId,
          text,
          isBlocker: BLOCKER_PATTERN.test(text),
          url: null,
          createdAt: ts
            ? new Date(parseFloat(ts) * 1000).toISOString()
            : null,
        };
      });
    return { activity };
  },
};
