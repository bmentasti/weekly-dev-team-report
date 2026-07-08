"use client";

import { useCallback, useEffect, useState } from "react";

interface UseFetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Hook común de data-fetching (H13): unifica loading/error/data y evita
 * repetir el patrón fetch-en-useEffect sin manejo de errores en cada
 * componente. Cancela con AbortController al desmontar / recargar.
 */
export function useFetch<T = unknown>(
  url: string | null,
  init?: RequestInit,
): UseFetchState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(!!url);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(url, { ...init, signal: controller.signal });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(
            (json && (json.error as string)) ??
              `Error ${res.status} al cargar datos.`,
          );
        }
        setData(json as T);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Error de red.");
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, nonce]);

  return { data, loading, error, reload };
}
