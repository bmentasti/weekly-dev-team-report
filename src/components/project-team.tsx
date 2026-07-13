"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/components/i18n-provider";

interface Member {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
}

interface WsMember {
  id: string;
  name: string;
  email: string;
}

export function ProjectTeam({ projectId }: { projectId: string }) {
  const { t } = useT();
  const roleLabel: Record<string, string> = {
    OWNER: "Owner",
    ADMIN: "Admin",
    MEMBER: t("ws.projectTeam.member"),
  };
  const [members, setMembers] = useState<Member[]>([]);
  const [wsMembers, setWsMembers] = useState<WsMember[]>([]);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [mRes, wRes] = await Promise.all([
      fetch(`/api/projects/${projectId}/members`),
      fetch(`/api/workspaces/members`),
    ]);
    if (mRes.ok) setMembers((await mRes.json()).members ?? []);
    if (wRes.ok) setWsMembers((await wRes.json()).members ?? []);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const memberUserIds = new Set(members.map((m) => m.userId));
  const available = wsMembers.filter((w) => !memberUserIds.has(w.id));

  async function add() {
    if (!selected) return;
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: selected }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? t("ws.projectTeam.cantAdd"));
      return;
    }
    setSelected("");
    load();
  }

  async function remove(id: string) {
    await fetch(`/api/projects/${projectId}/members/${id}`, {
      method: "DELETE",
    });
    load();
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {members.map((m) => (
          <Card key={m.id}>
            <CardContent className="flex items-center gap-3 py-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-bold text-primary">
                {(m.name ?? "?").charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/people/${encodeURIComponent(m.name)}`}
                  className="truncate font-semibold hover:text-primary hover:underline"
                >
                  {m.name}
                </Link>
                <p className="truncate text-sm text-muted-foreground">{m.email}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge variant={m.role === "OWNER" ? "default" : "secondary"}>
                  {roleLabel[m.role] ?? m.role}
                </Badge>
                {m.role !== "OWNER" && (
                  <button
                    onClick={() => remove(m.id)}
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    {t("ws.projectTeam.remove")}
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("ws.projectTeam.addToProject")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {error && (
            <p className="rounded-input bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          {available.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("ws.projectTeam.allInProject")}
            </p>
          ) : (
            <div className="flex gap-2">
              <select
                className="flex h-11 flex-1 rounded-input border border-input bg-card px-3 text-sm"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                <option value="">{t("ws.projectTeam.chooseMember")}</option>
                {available.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.email})
                  </option>
                ))}
              </select>
              <Button onClick={add} disabled={!selected}>
                {t("ws.projectTeam.add")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
