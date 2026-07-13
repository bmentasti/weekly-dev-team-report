import { safeFetch } from "@/lib/http";
import type { ActivitySignal, ProviderAdapter } from "../types";
import { BLOCKER_PATTERN } from "../blocker";

// Discord adapter (COMM). Auth: Authorization: Bot <token>.
// Lee los mensajes recientes de un canal.

const API = "https://discord.com/api/v10";

interface RawMsg {
  id: string;
  content?: string;
  timestamp?: string;
  author?: { username?: string };
}

function headers(token: string) {
  return { Authorization: `Bot ${token}` };
}

export const discordAdapter: ProviderAdapter = {
  slug: "discord",
  async testConnection(ctx) {
    try {
      const res = await safeFetch(`${API}/channels/${ctx.config.channelId}`, {
        headers: headers(ctx.secret),
        cache: "no-store",
      });
      if (res.status === 401) return { ok: false, error: "Bot token inválido." };
      if (res.status === 403)
        return { ok: false, error: "El bot no tiene acceso al canal." };
      if (res.status === 404) return { ok: false, error: "No se encontró el canal." };
      if (!res.ok) return { ok: false, error: `Discord respondió ${res.status}.` };
      return { ok: true, detail: "Canal de Discord conectado" };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Error." };
    }
  },
  async fetchData(ctx) {
    const res = await safeFetch(
      `${API}/channels/${ctx.config.channelId}/messages?limit=50`,
      { headers: headers(ctx.secret), cache: "no-store" },
    );
    if (!res.ok) throw new Error(`Discord devolvió ${res.status}.`);
    const messages = (await res.json()) as RawMsg[];

    const activity: ActivitySignal[] = (messages ?? [])
      .filter((m) => (m.content ?? "").trim().length > 0)
      .map((m) => ({
        source: "discord" as const,
        externalId: m.id,
        author: m.author?.username ?? null,
        channel: ctx.config.channelId,
        text: m.content ?? "",
        isBlocker: BLOCKER_PATTERN.test(m.content ?? ""),
        url: null,
        createdAt: m.timestamp ?? null,
      }));
    return { activity };
  },
};
