"use client";

import { useCallback, useEffect, useState } from "react";
import { UserPlus, Trash2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDialogs } from "@/components/ui/dialog-provider";
import { useT } from "@/components/i18n-provider";

type Role = "ADMIN" | "MEMBER" | "VIEWER";

interface Member {
  id: string;
  name: string | null;
  email: string;
  role: string;
  roleLabel: string;
  isOwner: boolean;
}

function roleHelp(t: (key: string) => string): Record<Role, string> {
  return {
    ADMIN: t("ws.members.adminHelp"),
    MEMBER: t("ws.members.memberHelp"),
    VIEWER: t("ws.members.viewerHelp"),
  };
}

function roleVariant(role: string): "default" | "info" | "secondary" {
  if (role === "OWNER" || role === "ADMIN") return "default";
  if (role === "VIEWER") return "secondary";
  return "info";
}

export function MembersManager() {
  const { t } = useT();
  const dialogs = useDialogs();
  const [members, setMembers] = useState<Member[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [canInvite, setCanInvite] = useState(false);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("MEMBER");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/workspaces/members");
      const data = await res.json();
      setMembers(data.members ?? []);
      setCanManage(!!data.canManage);
      setCanInvite(!!data.canInvite);
      setMyRole(data.myRole ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function invite() {
    setError(null);
    const res = await fetch("/api/workspaces/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role: inviteRole }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? t("ws.members.cantInvite"));
      return;
    }
    setEmail("");
    load();
  }

  async function changeRole(userId: string, role: string) {
    const res = await fetch("/api/workspaces/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      await dialogs.alert({ title: t("ws.members.cantChangeRole"), description: d.error });
      return;
    }
    load();
  }

  async function remove(userId: string, name: string) {
    const ok = await dialogs.confirm({
      title: `${t("ws.members.removeTitlePrefix")} ${name} ${t("ws.members.removeTitleSuffix")}`,
      confirmLabel: t("ws.members.remove"),
      danger: true,
    });
    if (!ok) return;
    await fetch(`/api/workspaces/members?userId=${encodeURIComponent(userId)}`, {
      method: "DELETE",
    });
    load();
  }

  if (loading) return <div className="h-32 animate-pulse rounded-card bg-muted" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldCheck className="h-5 w-5 text-primary" />
          {t("ws.members.title")}
          {myRole && (
            <Badge variant="outline" className="ml-2 text-[10px]">
              {`${t("ws.members.yourRolePrefix")} ${myRole}`}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!canManage && !canInvite && (
          <p className="text-sm text-muted-foreground">
            {t("ws.members.readonlyHelp")}
          </p>
        )}

        <div className="space-y-2">
          {members.map((m) => (
            <div
              key={m.id}
              className="flex flex-wrap items-center gap-3 rounded-input border px-3 py-2 text-sm"
            >
              <div className="min-w-0 flex-1">
                <span className="font-medium">{m.name ?? m.email}</span>
                {m.name && (
                  <span className="ml-2 text-xs text-muted-foreground">{m.email}</span>
                )}
              </div>
              {m.isOwner ? (
                <Badge variant="default">{t("ws.members.owner")}</Badge>
              ) : canManage ? (
                <select
                  value={m.role}
                  onChange={(e) => changeRole(m.id, e.target.value)}
                  className="rounded-md border bg-card px-2 py-1 text-xs"
                >
                  <option value="ADMIN">Admin</option>
                  <option value="MEMBER">Member</option>
                  <option value="VIEWER">Viewer</option>
                </select>
              ) : (
                <Badge variant={roleVariant(m.role)}>{m.roleLabel}</Badge>
              )}
              {canManage && !m.isOwner && (
                <button
                  onClick={() => remove(m.id, m.name ?? m.email)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={t("ws.members.remove")}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        {canInvite && (
          <div className="space-y-2 border-t pt-3">
            {error && (
              <p className="rounded-input bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Input
                type="email"
                placeholder={t("ws.members.emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as Role)}
                className="rounded-md border bg-card px-2 py-1 text-sm"
              >
                <option value="ADMIN">Admin</option>
                <option value="MEMBER">Member</option>
                <option value="VIEWER">Viewer</option>
              </select>
              <Button size="sm" disabled={!email.trim()} onClick={invite}>
                <UserPlus className="mr-1 h-4 w-4" /> {t("ws.members.invite")}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {`${roleHelp(t)[inviteRole]} ${t("ws.members.needAccount")}`}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
