import type { ActivitySignal, ProviderAdapter } from "../types";
import { BLOCKER_PATTERN, stripHtml } from "../blocker";

// Microsoft Teams adapter (COMM). Usa un access token de Microsoft Graph con
// ChannelMessage.Read. Lee los mensajes recientes de un canal.

const GRAPH = "https://graph.microsoft.com/v1.0";

interface RawMsg {
  id: string;
  createdDateTime?: string;
  body?: { content?: string };
  from?: { user?: { displayName?: string } };
}

export const teamsAdapter: ProviderAdapter = {
  slug: "teams",
  async testConnection(ctx) {
    const { teamId, channelId } = ctx.config;
    try {
      const res = await fetch(`${GRAPH}/teams/${teamId}/channels/${channelId}`, {
        headers: { Authorization: `Bearer ${ctx.secret}` },
        cache: "no-store",
      });
      if (res.status === 401) return { ok: false, error: "Token de Graph inválido o expirado." };
      if (res.status === 403)
        return { ok: false, error: "El token no tiene permiso ChannelMessage.Read." };
      if (res.status === 404) return { ok: false, error: "No se encontró el canal." };
      if (!res.ok) return { ok: false, error: `Graph respondió ${res.status}.` };
      return { ok: true, detail: "Canal de Teams conectado" };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Error." };
    }
  },
  async fetchData(ctx) {
    const { teamId, channelId } = ctx.config;
    const res = await fetch(
      `${GRAPH}/teams/${teamId}/channels/${channelId}/messages?$top=50`,
      { headers: { Authorization: `Bearer ${ctx.secret}` }, cache: "no-store" },
    );
    if (!res.ok) throw new Error(`Graph devolvió ${res.status}.`);
    const data = (await res.json()) as { value?: RawMsg[] };

    const activity: ActivitySignal[] = (data.value ?? [])
      .map((m) => {
        const text = stripHtml(m.body?.content ?? "");
        return {
          source: "teams" as const,
          externalId: m.id,
          author: m.from?.user?.displayName ?? null,
          channel: channelId,
          text,
          isBlocker: BLOCKER_PATTERN.test(text),
          url: null,
          createdAt: m.createdDateTime ?? null,
        };
      })
      .filter((a) => a.text.length > 0);
    return { activity };
  },
};
