"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function NewWorkspacePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const teamSizeRaw = String(formData.get("teamSize") || "").trim();
    const payload = {
      name: String(formData.get("name")),
      companyName: String(formData.get("companyName") || ""),
      teamName: String(formData.get("teamName") || ""),
      ...(teamSizeRaw ? { teamSize: Number(teamSizeRaw) } : {}),
    };

    const res = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo crear el workspace.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>Crear workspace</CardTitle>
          <CardDescription>
            Un espacio para agrupar integraciones, proyectos y reportes de tu
            equipo.
          </CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="name">Nombre del workspace</Label>
              <Input
                id="name"
                name="name"
                placeholder="Equipo Frontend"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyName">Nombre de empresa</Label>
              <Input id="companyName" name="companyName" placeholder="ForIT" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teamName">Nombre del equipo</Label>
              <Input id="teamName" name="teamName" placeholder="Frontend" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teamSize">Tamaño del equipo</Label>
              <Input
                id="teamSize"
                name="teamSize"
                type="number"
                min={1}
                placeholder="8"
              />
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push("/dashboard")}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creando..." : "Crear workspace"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
