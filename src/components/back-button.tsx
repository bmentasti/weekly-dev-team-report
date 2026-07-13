"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useT } from "@/components/i18n-provider";

export function BackButton({ label }: { label?: string }) {
  const router = useRouter();
  const { t } = useT();
  return (
    <button
      onClick={() => router.back()}
      className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      {label ?? t("mc.back.default")}
    </button>
  );
}
