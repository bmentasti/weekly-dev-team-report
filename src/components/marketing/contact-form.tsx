"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/components/i18n-provider";

const CONTACT_EMAIL = "hola@devmetrics.app";

export function ContactForm() {
  const { t } = useT();
  const [sent, setSent] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = String(data.get("name") || "");
    const email = String(data.get("email") || "");
    const message = String(data.get("message") || "");
    const subject = encodeURIComponent(`${t("mc.contact.subjectPrefix")} ${name}`);
    const body = encodeURIComponent(`${message}\n\n— ${name} (${email})`);
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
    setSent(true);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {sent && (
        <p className="rounded-input bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {t("mc.contact.sent")}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">{t("mc.contact.name")}</Label>
          <Input id="name" name="name" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">{t("mc.contact.email")}</Label>
          <Input id="email" name="email" type="email" required />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="message">{t("mc.contact.message")}</Label>
        <textarea
          id="message"
          name="message"
          rows={4}
          required
          className="w-full rounded-input border border-input bg-white px-3.5 py-2 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
        />
      </div>
      <Button type="submit" className="h-11 w-full sm:w-auto">
        {t("mc.contact.send")}
      </Button>
      <p className="text-xs text-muted-foreground">
        {t("mc.contact.orWrite")}{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
          {CONTACT_EMAIL}
        </a>
      </p>
    </form>
  );
}
