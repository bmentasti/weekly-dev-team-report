import { lookup } from "node:dns/promises";
import net from "node:net";

/**
 * HTTP helpers compartidos por todos los adapters de integración.
 *
 * - safeFetch: agrega timeout duro (AbortSignal.timeout) a cualquier fetch para
 *   evitar que un endpoint externo lento cuelgue la generación de reportes.
 * - assertSafeUrl: valida URLs provistas por el usuario (providers self-hosted:
 *   GitLab, Azure DevOps, MS Project/Server, Primavera) para mitigar SSRF hacia
 *   la red interna del servidor.
 */

const DEFAULT_TIMEOUT_MS = 10_000;

export class HttpTimeoutError extends Error {
  constructor(url: string, ms: number) {
    super(`Request a ${url} excedió el timeout de ${ms}ms`);
    this.name = "HttpTimeoutError";
  }
}

/**
 * Error HTTP con status. Lo usan los adapters (vía `fetchWithRetry`/`assertOk`)
 * para que la capa de salud pueda clasificar 401/403/429/5xx sin parsear texto.
 */
export class HttpError extends Error {
  status: number;
  retryAfterMs: number | null;
  constructor(status: number, message: string, retryAfterMs: number | null = null) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

/** Lee Retry-After (segundos o fecha) y headers de rate limit → ms de espera. */
export function retryAfterMs(res: Response): number | null {
  const ra = res.headers.get("retry-after");
  if (ra) {
    const secs = Number(ra);
    if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
    const when = Date.parse(ra);
    if (Number.isFinite(when)) return Math.max(0, when - Date.now());
  }
  // GitHub/GitLab: X-RateLimit-Reset (epoch segundos) cuando remaining == 0.
  const remaining = res.headers.get("x-ratelimit-remaining");
  const reset = res.headers.get("x-ratelimit-reset");
  if (remaining === "0" && reset) {
    const resetMs = Number(reset) * 1000 - Date.now();
    if (Number.isFinite(resetMs) && resetMs > 0) return resetMs;
  }
  return null;
}

/**
 * fetch con reintentos y exponential backoff. Reintenta en 429 y 5xx y ante
 * errores de red/timeout. Respeta Retry-After / X-RateLimit-Reset. Devuelve la
 * Response (incluida la última aunque no sea ok) para que el caller decida.
 *
 * Es idempotente por diseño: usarlo solo para requests seguros (GET) o para POST
 * de búsqueda sin efectos secundarios (como el search de Jira).
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  opts: { retries?: number; baseDelayMs?: number; maxDelayMs?: number; timeoutMs?: number } = {},
): Promise<Response> {
  const { retries = 3, baseDelayMs = 500, maxDelayMs = 8_000, timeoutMs } = opts;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await safeFetch(url, init, timeoutMs ?? DEFAULT_TIMEOUT_MS);
      if (res.status === 429 || res.status >= 500) {
        if (attempt < retries) {
          const wait = retryAfterMs(res) ?? Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
          await sleep(wait);
          continue;
        }
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await sleep(Math.min(maxDelayMs, baseDelayMs * 2 ** attempt));
        continue;
      }
      throw err;
    }
  }
  // Inalcanzable en la práctica, pero satisface el tipo de retorno.
  throw lastErr ?? new Error(`fetchWithRetry agotó reintentos para ${url}`);
}

/** Lanza HttpError si la respuesta no es ok (para que la salud pueda clasificar). */
export async function assertOk(res: Response, label = "request"): Promise<Response> {
  if (res.ok) return res;
  let detail = "";
  try {
    detail = (await res.clone().text()).slice(0, 300);
  } catch {
    /* cuerpo ilegible */
  }
  throw new HttpError(
    res.status,
    `${label} falló con HTTP ${res.status}${detail ? `: ${detail}` : ""}`,
    retryAfterMs(res),
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * fetch con timeout duro y `cache: no-store` por defecto. Si el caller pasa su
 * propio `signal`, se combina con el timeout.
 */
export async function safeFetch(
  url: string,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal = init.signal
    ? anySignal([init.signal, timeoutSignal])
    : timeoutSignal;
  try {
    return await fetch(url, { cache: "no-store", ...init, signal });
  } catch (err) {
    if (
      err instanceof DOMException &&
      (err.name === "TimeoutError" || err.name === "AbortError")
    ) {
      throw new HttpTimeoutError(url, timeoutMs);
    }
    throw err;
  }
}

/** Combina varios AbortSignal en uno (aborta cuando el primero aborta). */
function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const s of signals) {
    if (s.aborted) {
      controller.abort(s.reason);
      break;
    }
    s.addEventListener("abort", () => controller.abort(s.reason), {
      once: true,
    });
  }
  return controller.signal;
}

/** Rangos IP privados / reservados que no deben ser alcanzables por SSRF. */
function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 10) return true;
    if (a === 127) return true; // loopback
    if (a === 169 && b === 254) return true; // link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 0) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const low = ip.toLowerCase();
    if (low === "::1") return true; // loopback
    if (low.startsWith("fe80")) return true; // link-local
    if (low.startsWith("fc") || low.startsWith("fd")) return true; // ULA
    if (low.startsWith("::ffff:")) return isPrivateIp(low.replace("::ffff:", ""));
    return false;
  }
  return false;
}

export interface SafeUrlOptions {
  /** Permitir http:// además de https:// (default: false). */
  allowInsecure?: boolean;
  /** Resolver DNS y bloquear IPs privadas/loopback (default: true). */
  blockPrivate?: boolean;
}

/**
 * Valida una URL provista por el usuario. Lanza Error si:
 * - no es una URL válida
 * - el esquema no es https (o http si allowInsecure)
 * - el host resuelve a una IP privada / loopback / metadata (SSRF)
 *
 * Devuelve la URL normalizada (sin trailing slash).
 */
export async function assertSafeUrl(
  raw: string | undefined | null,
  opts: SafeUrlOptions = {},
): Promise<string> {
  const { allowInsecure = false, blockPrivate = true } = opts;
  if (!raw || typeof raw !== "string" || raw.trim() === "") {
    throw new Error("URL vacía o inválida");
  }
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error(`URL inválida: ${raw}`);
  }
  const allowed = allowInsecure ? ["https:", "http:"] : ["https:"];
  if (!allowed.includes(url.protocol)) {
    throw new Error(
      `Esquema no permitido (${url.protocol}); se requiere ${allowed.join(" o ")}`,
    );
  }
  if (blockPrivate) {
    const host = url.hostname;
    // Bloqueo directo si el host ya es una IP privada.
    if (net.isIP(host) && isPrivateIp(host)) {
      throw new Error(`Host no permitido (IP privada/reservada): ${host}`);
    }
    if (host === "localhost") {
      throw new Error("Host no permitido: localhost");
    }
    // Resolver DNS y verificar todas las direcciones.
    try {
      const records = await lookup(host, { all: true });
      for (const r of records) {
        if (isPrivateIp(r.address)) {
          throw new Error(
            `Host resuelve a una IP privada/reservada (${r.address}): ${host}`,
          );
        }
      }
    } catch (err) {
      // Si el error es nuestro (IP privada), re-lanzar; si es fallo de DNS,
      // dejamos pasar y que el fetch falle (no queremos bloquear por DNS lento).
      if (err instanceof Error && err.message.includes("IP privada")) throw err;
    }
  }
  return url.toString().replace(/\/$/, "");
}
