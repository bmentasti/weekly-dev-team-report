"use client";

import { useCallback, useEffect, useState } from "react";
import { Users, Merge, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDialogs } from "@/components/ui/dialog-provider";
import { useT } from "@/components/i18n-provider";

interface Person {
  id: string;
  name: string;
  rawHandles: string[];
}

interface Identity {
  id: string;
  key: string;
  displayName: string;
  aliases: { source: string; handle: string }[];
}

export function IdentityManager({ projectId }: { projectId?: string }) {
  const { t } = useT();
  const { prompt, confirm } = useDialogs();
  const [people, setPeople] = useState<Person[]>([]);
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";

  const load = useCallback(async () => {
    setLoaded(false);
    const res = await fetch(`/api/people/identities${qs}`);
    if (res.ok) {
      const json = await res.json();
      setPeople(json.people ?? []);
      setIdentities(json.identities ?? []);
    }
    setSelected(new Set());
    setLoaded(true);
  }, [qs]);

  useEffect(() => {
    load();
  }, [load]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function merge() {
    const ids = Array.from(selected);
    if (ids.length < 2) return;
    const primary = people.find((p) => p.id === ids[0]);
    const name = await prompt({
      title: t("ws.identity.merge"),
      label: t("ws.identity.mergePrompt"),
      defaultValue: primary?.name ?? "",
    });
    if (!name) return;
    setBusy(true);
    await fetch(`/api/people/identities${qs}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        primaryId: ids[0],
        displayName: name,
        mergeIds: ids.slice(1),
      }),
    });
    setBusy(false);
    await load();
  }

  async function unmerge(identity: Identity) {
    const ok = await confirm({
      title: `${t("ws.identity.unmerge")} «${identity.displayName}»`,
      confirmLabel: t("ws.identity.unmerge"),
    });
    if (!ok) return;
    setBusy(true);
    await fetch(
      `/api/people/identities?id=${encodeURIComponent(identity.id)}${
        projectId ? `&projectId=${encodeURIComponent(projectId)}` : ""
      }`,
      { method: "DELETE" },
    );
    setBusy(false);
    await load();
  }

  if (!loaded) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-lg">{t("ws.identity.title")}</CardTitle>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("ws.identity.subtitle")}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {people.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("ws.identity.empty")}</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {selected.size >= 1
                  ? `${selected.size} ${t("ws.identity.selectedCount")}`
                  : t("ws.identity.selectToMerge")}
              </p>
              <Button
                size="sm"
                onClick={merge}
                disabled={selected.size < 2 || busy}
              >
                <Merge className="mr-1 h-4 w-4" />
                {busy ? t("ws.identity.merging") : t("ws.identity.merge")}
              </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {people.map((p) => (
                <label
                  key={p.id}
                  className={`flex cursor-pointer items-start gap-2 rounded-input border p-2 text-sm ${
                    selected.has(p.id) ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={selected.has(p.id)}
                    onChange={() => toggle(p.id)}
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{p.name}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {p.id}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </>
        )}

        {identities.length > 0 && (
          <div className="border-t pt-4">
            <p className="mb-2 text-sm font-medium">{t("ws.identity.mergedTitle")}</p>
            <div className="space-y-2">
              {identities.map((idn) => (
                <div
                  key={idn.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-input border p-2 text-sm"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{idn.displayName}</span>
                    <Badge variant="secondary">
                      {`${idn.aliases.length + 1} ${t("ws.identity.aliasesLabel")}`}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      {[idn.key, ...idn.aliases.map((a) => a.handle)].join(" · ")}
                    </span>
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => unmerge(idn)}
                    disabled={busy}
                  >
                    <X className="mr-1 h-4 w-4" />
                    {t("ws.identity.unmerge")}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
