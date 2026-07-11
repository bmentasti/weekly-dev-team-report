"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // En producción esto iría a un servicio de observabilidad (Sentry, etc.).
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-card border bg-card p-8 text-center shadow-card">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-6 w-6" />
      </span>
      <div>
        <h2 className="text-lg font-semibold">Algo salió mal</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          No pudimos cargar esta sección. Podés reintentar o volver al inicio.
        </p>
      </div>
      <div className="flex gap-2">
        <Button onClick={reset}>Reintentar</Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard">Ir al inicio</Link>
        </Button>
      </div>
    </div>
  );
}
