"use client";

// Backoffice interno (solo superadmin). Texto en español a propósito:
// no pasa por i18n porque no es una pantalla de clientes.

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface AdminWorkspace {
  id: string;
  name: string;
  plan: "FREE" | "TEAM" | "PRO";
  billingPeriod: string;
  trialEndsAt: string | null;
  reportQuotaOverride: number | null;
  planQuota: number | null;
  usedThisMonth: number;
}

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isSuperAdmin: boolean;
  createdAt: string;
  workspaces: AdminWorkspace[];
}

const ROLES: Record<string, string> = {
  TECH_LEAD: "Tech Lead",
  PRODUCT_OWNER: "Product Owner",
  ENGINEERING_MANAGER: "Eng. Manager",
  CTO: "CTO",
  DEVELOPER_LEAD: "Dev Lead",
  OTHER: "Otro",
};

const PLAN_BADGE: Record<string, string> = {
  FREE: "bg-slate-100 text-slate-700",
  TEAM: "bg-blue-100 text-blue-700",
  PRO: "bg-emerald-100 text-emerald-700",
};

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      const json = await res.json();
      if (!res.ok) setError(json.error ?? "No se pudo cargar.");
      else setUsers(json.users);
    } catch {
      setError("Error de red.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  function flash(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2500);
  }

  async function saveRole(userId: string, role: string) {
    setSaving(userId);
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    setSaving(null);
    if (res.ok) flash("Rol actualizado.");
    else flash("No se pudo actualizar el rol.");
    load();
  }

  async function deleteUser(u: AdminUser) {
    const ok = window.confirm(
      `¿Eliminar a ${u.name} (${u.email})?\n\nSe borran TAMBIÉN sus workspaces propios con todos sus proyectos, reportes e integraciones. Esta acción no se puede deshacer.`,
    );
    if (!ok) return;
    setSaving(u.id);
    const res = await fetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
    setSaving(null);
    if (res.ok) flash("Usuario eliminado.");
    else {
      const json = await res.json().catch(() => ({}));
      flash(json.error ?? "No se pudo eliminar el usuario.");
    }
    load();
  }

  async function saveWorkspace(
    wsId: string,
    patch: { plan?: string; reportQuotaOverride?: number | null },
  ) {
    setSaving(wsId);
    const res = await fetch(`/api/admin/workspaces/${wsId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setSaving(null);
    if (res.ok) flash("Workspace actualizado.");
    else flash("No se pudo actualizar el workspace.");
    load();
  }

  const filtered = users.filter(
    (u) =>
      !q ||
      `${u.name} ${u.email}`.toLowerCase().includes(q.toLowerCase()),
  );

  if (loading)
    return <p className="p-8 text-sm text-muted-foreground">Cargando backoffice…</p>;
  if (error)
    return (
      <div className="p-8">
        <p className="text-sm text-destructive">{error}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Iniciá sesión con el usuario administrador para acceder.
        </p>
      </div>
    );

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Backoffice</h1>
          <p className="text-sm text-muted-foreground">
            Usuarios registrados, planes y cuotas. Los cambios se aplican al instante.
          </p>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre o email…"
          className="h-9 rounded-input border px-3 text-sm"
        />
      </div>

      {notice && (
        <p className="rounded-input bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {notice}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Usuarios ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Usuario</th>
                  <th className="py-2 pr-3 font-medium">Rol</th>
                  <th className="py-2 pr-3 font-medium">Registrado</th>
                  <th className="py-2 pr-3 font-medium">Workspace / Plan / Cuota mensual</th>
                  <th className="py-2 pr-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="border-b align-top last:border-0">
                    <td className="py-3 pr-3">
                      <div className="font-medium">
                        {u.name}{" "}
                        {u.isSuperAdmin && (
                          <Badge variant="secondary">admin</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </td>
                    <td className="py-3 pr-3">
                      <select
                        className="h-8 rounded-input border px-2 text-sm"
                        value={u.role}
                        disabled={saving === u.id}
                        onChange={(e) => saveRole(u.id, e.target.value)}
                      >
                        {Object.entries(ROLES).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 pr-3 text-xs text-muted-foreground">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 pr-3">
                      {u.workspaces.length === 0 && (
                        <span className="text-xs text-muted-foreground">
                          Sin workspace propio
                        </span>
                      )}
                      <div className="space-y-2">
                        {u.workspaces.map((w) => (
                          <WorkspaceRow
                            key={w.id}
                            ws={w}
                            saving={saving === w.id}
                            onSave={saveWorkspace}
                          />
                        ))}
                      </div>
                    </td>
                    <td className="py-3">
                      {!u.isSuperAdmin && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:bg-destructive/10"
                          disabled={saving === u.id}
                          onClick={() => deleteUser(u)}
                        >
                          Eliminar
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function WorkspaceRow({
  ws,
  saving,
  onSave,
}: {
  ws: AdminWorkspace;
  saving: boolean;
  onSave: (
    wsId: string,
    patch: { plan?: string; reportQuotaOverride?: number | null },
  ) => void;
}) {
  const [plan, setPlan] = useState<string>(ws.plan);
  const [quota, setQuota] = useState<string>(
    ws.reportQuotaOverride === null ? "" : String(ws.reportQuotaOverride),
  );
  const effectiveQuota =
    ws.reportQuotaOverride ?? ws.planQuota;
  const dirty =
    plan !== ws.plan ||
    quota !== (ws.reportQuotaOverride === null ? "" : String(ws.reportQuotaOverride));

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-input border p-2">
      <span className="font-medium">{ws.name}</span>
      <span
        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${PLAN_BADGE[ws.plan] ?? ""}`}
      >
        {ws.plan}
      </span>
      {ws.trialEndsAt && new Date(ws.trialEndsAt) > new Date() && (
        <Badge variant="secondary">trial Pro</Badge>
      )}
      <span className="text-xs text-muted-foreground">
        Uso: {ws.usedThisMonth}/{effectiveQuota ?? "∞"} este mes
      </span>
      <select
        className="h-8 rounded-input border px-2 text-sm"
        value={plan}
        disabled={saving}
        onChange={(e) => setPlan(e.target.value)}
      >
        <option value="FREE">Free</option>
        <option value="TEAM">Team</option>
        <option value="PRO">Pro</option>
      </select>
      <input
        type="number"
        min={0}
        value={quota}
        disabled={saving}
        onChange={(e) => setQuota(e.target.value)}
        placeholder={ws.planQuota === null ? "∞ (plan)" : `${ws.planQuota} (plan)`}
        className="h-8 w-28 rounded-input border px-2 text-sm"
        title="Cuota mensual de reportes. Vacío = usar la del plan."
      />
      <Button
        size="sm"
        variant="outline"
        disabled={saving || !dirty}
        onClick={() =>
          onSave(ws.id, {
            ...(plan !== ws.plan ? { plan } : {}),
            reportQuotaOverride: quota === "" ? null : Number(quota),
          })
        }
      >
        {saving ? "Guardando…" : "Guardar"}
      </Button>
    </div>
  );
}
