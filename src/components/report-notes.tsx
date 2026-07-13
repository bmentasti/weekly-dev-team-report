"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDialogs } from "@/components/ui/dialog-provider";
import { useT } from "@/components/i18n-provider";

interface Note {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export function ReportNotes({ reportId }: { reportId: string }) {
  const { t } = useT();
  const { confirm } = useDialogs();
  const [notes, setNotes] = useState<Note[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/reports/${reportId}/notes`);
    if (!res.ok) return;
    const json = await res.json();
    setNotes(json.notes ?? []);
    setCurrentUserId(json.currentUserId ?? null);
  }, [reportId]);

  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    if (!draft.trim()) return;
    setSaving(true);
    await fetch(`/api/reports/${reportId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: draft }),
    });
    setDraft("");
    setSaving(false);
    load();
  }

  async function saveEdit(id: string) {
    await fetch(`/api/reports/${reportId}/notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: editBody }),
    });
    setEditingId(null);
    load();
  }

  async function remove(id: string) {
    const ok = await confirm({
      title: t("rep.deleteNote"),
      confirmLabel: t("rep.deleteConfirmLabel"),
      danger: true,
    });
    if (!ok) return;
    await fetch(`/api/reports/${reportId}/notes/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("rep.notes")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {notes.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {t("rep.noNotesYet")}
            </p>
          )}
          {notes.map((n) => (
            <div key={n.id} className="rounded-md border p-3">
              {editingId === n.id ? (
                <div className="space-y-2">
                  <textarea
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    rows={3}
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => saveEdit(n.id)}>
                      {t("rep.save")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingId(null)}
                    >
                      {t("rep.cancel")}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="whitespace-pre-wrap text-sm">{n.body}</p>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">
                      {n.authorName} · {new Date(n.createdAt).toLocaleString()}
                      {n.updatedAt !== n.createdAt ? ` ${t("rep.edited")}` : ""}
                    </span>
                    {currentUserId === n.authorId && (
                      <span className="flex gap-2">
                        <button
                          className="text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setEditingId(n.id);
                            setEditBody(n.body);
                          }}
                        >
                          {t("rep.edit")}
                        </button>
                        <button
                          className="text-xs text-muted-foreground hover:text-destructive"
                          onClick={() => remove(n.id)}
                        >
                          {t("rep.delete")}
                        </button>
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <textarea
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            rows={3}
            placeholder={t("rep.notePlaceholder")}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <Button size="sm" onClick={add} disabled={saving || !draft.trim()}>
            {saving ? t("rep.saving") : t("rep.addNote")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
