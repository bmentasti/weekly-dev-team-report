"use client";

import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDialogs } from "@/components/ui/dialog-provider";

export function UpgradeButton({
  feature,
  suggestedPlan = "Team",
  className,
}: {
  feature: string;
  suggestedPlan?: "Team" | "Pro";
  className?: string;
}) {
  const { upgrade } = useDialogs();
  return (
    <Button
      variant="outline"
      size="sm"
      className={className}
      onClick={() => upgrade({ feature, suggestedPlan })}
    >
      <Lock className="mr-1.5 h-3.5 w-3.5" />
      Mejorar plan
    </Button>
  );
}
