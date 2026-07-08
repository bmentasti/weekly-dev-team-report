"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Share {
  id: string;
  name: string | null;
  email: string | null;
  pending: boolean;
  viewedAt: string | null;
  level?: string;
}

interface Member {
  id: string;
  name: string;
  email: string;
}

export function ReportShares({ reportId }: { reportId: string }) {
  const [shares, setShares] = useState<Share[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMember, setSelectedMember] = useState("");
  const [email, setEmail] = useState("");
  const [level, setLevel] = useState<"FULL" | "EXECUTIVE">("FULL");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [sRes, mRes] = await Promise.all([
      fetch(`/api/reports/${reportId}/shares`),
      fetch(`/api/workspaces/members`),
    ]);
    if (sRes.ok) setShares((await sRes.json()).shares ?? []);
    if (mRes.ok) setMembers((await mRes.json()).members ?? []);
  }, [reportId]);

  useEffect(() => {
    load();
  }, [load]);

  const sharedIds = new Set(
    shares.map((s) => s.email?.toLowerCase()).filter(Boolean),
  );

  async function addShare(payload: { userId?: string; email?: string }) {
    setError(null);
    const res = await fetch(`/api/reports/${reportId}/shares`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, level }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "No se pudo compartir.");
      return;
    }
    setSelectedMember("");
    setEmail("");
    load();
  }

  async function remove(id: string) {
    await fetch(`/api/reports/${reportId}/shares/${id}`, { method: "DELETE" });
    load();
  }

  const availableMembers = members.filter(
    (m) => !sharedIds.has(m.email.toLowerCase()),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Compartir</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {shares.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Este reporte todavía no está compartido con nadie.
            </p>
          )}
          {shares.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <span className="font-medium">{s.name ?? s.email}</span>
                {s.name && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {s.email}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">
                  {s.level === "EXECUTIVE" ? "Ejecutiva" : "Completa"}
                </Badge>
                {s.pending ? (
                  <Badge variant="outline">Invitado</Badge>
                ) : s.viewedAt ? (
                  <Badge variant="success">
                    Visto {new Date(s.viewedAt).toLocaleDateString()}
                  </Badge>
                ) : (
                  <Badge variant="warning">Sin ver</Badge>
                )}
                <button
                  className="text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => remove(s.id)}
                >
                  Quitar
                </button>
              </div>
            </div>
          ))}
        </div>

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="space-y-3 border-t pt-3">
          <div>
            <label className="text-xs text-muted-foreground">Nivel de vista</label>
            <select
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={level}
              onChange={(e) => setLevel(e.target.value as "FULL" | "EXECUTIVE")}
            >
              <option value="FULL">Completa (incluye datos por persona)</option>
              <option value="EXECUTIVE">Ejecutiva (sin datos por persona)</option>
            </select>
          </div>
          {availableMembers.length > 0 && (
            <div className="flex gap-2">
              <select
                className="flex h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedMember}
                onChange={(e) => setSelectedMember(e.target.value)}
              >
                <option value="">Elegir miembro del equipo...</option>
                {availableMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.email})
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                disabled={!selectedMember}
                onClick={() => addShare({ userId: selectedMember })}
              >
                Agregar
              </Button>
            </div>
          )}
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="o invitar por email..."
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={!email.trim()}
              onClick={() => addShare({ email })}
            >
              Invitar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
