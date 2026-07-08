"use client";

// Boundary de último recurso (errores en el root layout). Debe renderizar su
// propio <html>/<body>. (H6)
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          background: "#f7f9fc",
          color: "#0b1d3a",
          margin: 0,
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center", padding: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>Error inesperado</h2>
          <p style={{ marginTop: 8, color: "#64748b" }}>
            Ocurrió un problema al cargar la aplicación. Probá recargar.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 16,
              background: "#2563ff",
              color: "#fff",
              border: 0,
              borderRadius: 10,
              padding: "10px 18px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reintentar
          </button>
          {error.digest && (
            <p style={{ marginTop: 12, fontSize: 12, color: "#94a3b8" }}>
              Ref: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
