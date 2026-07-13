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
