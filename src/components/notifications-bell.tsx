"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n-provider";

interface Notification {
  id: string;
  type: string;
  reportId: string | null;
  message: string;
  readAt: string | null;
  createdAt: string;
}

export function NotificationsBell() {
  const router = useRouter();
  const { t } = useT();
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const json = await res.json();
      setItems(json.notifications ?? []);
      setUnread(json.unread ?? 0);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    load();
    let t: ReturnType<typeof setInterval> | null = null;
    // Solo hacemos polling cuando la pestaña está visible (evita requests
    // en background y batería/CPU innecesarios).
    function start() {
      if (t) return;
      t = setInterval(load, 30000);
    }
    function stop() {
      if (t) {
        clearInterval(t);
        t = null;
      }
    }
    function onVisibility() {
      if (document.visibilityState === "visible") {
        load();
        start();
      } else {
        stop();
      }
    }
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  async function markAllRead() {
    await fetch("/api/notifications/read", { method: "POST" });
    setUnread(0);
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? "now" })));
  }

  async function openItem(n: Notification) {
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: n.id }),
    });
    setOpen(false);
    if (n.reportId) router.push(`/reports/${n.reportId}`);
    load();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-md px-2 py-1 text-sm text-muted-foreground hover:text-foreground"
        aria-label={unread > 0 ? `${t("ws.notifications.ariaWithUnreadPrefix")}${unread}${t("ws.notifications.ariaWithUnreadSuffix")}` : t("ws.notifications.aria")}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Bell aria-hidden="true" className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg border bg-background shadow-lg">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-sm font-semibold">{t("ws.notifications.title")}</span>
            {unread > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllRead}>
                {t("ws.notifications.markRead")}
              </Button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                {t("ws.notifications.empty")}
              </p>
            )}
            {items.map((n) => (
              <button
                key={n.id}
                onClick={() => openItem(n)}
                className={`block w-full border-b px-3 py-2 text-left text-sm last:border-0 hover:bg-muted/50 ${
                  n.readAt ? "text-muted-foreground" : "font-medium"
                }`}
              >
                {!n.readAt && (
                  <span className="mr-1 inline-block h-2 w-2 rounded-full bg-primary align-middle" />
                )}
                {n.message}
                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  {new Date(n.createdAt).toLocaleString()}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
