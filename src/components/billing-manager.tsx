"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PaymentModal } from "@/components/payment-modal";
import {
  PLANS,
  PLAN_ORDER,
  annualTotal,
  limitLabel,
  type PlanTierName,
  type BillingPeriodName,
} from "@/lib/plans";

const FEATURES: Record<PlanTierName, string[]> = {
  FREE: ["1 proyecto", "Jira + GitHub", "Reporte manual + CSV", "Hasta 5 usuarios"],
  TEAM: [
    "Todas las integraciones",
    "Riesgos, capacidad y recomendaciones",
    "Email + compartir + notas",
    "Hasta 45 usuarios",
  ],
  PRO: [
    "Multi-proyecto",
    "Comparativas y ejecutivos",
    "Envío a Slack",
    "Usuarios ilimitados",
  ],
};

export function BillingManager({
  currentPlan,
  currentPeriod,
}: {
  currentPlan: PlanTierName;
  currentPeriod: BillingPeriodName;
}) {
  const router = useRouter();
  const [annual, setAnnual] = useState(currentPeriod === "ANNUAL");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [payFor, setPayFor] = useState<PlanTierName | null>(null);

  async function change(plan: PlanTierName) {
    // Plan pago → abrir el modal de pago. Free (downgrade) → aplicar directo.
    if (PLANS[plan].monthly > 0) {
      setPayFor(plan);
      return;
    }
    setBusy(plan);
    setMsg(null);
    const res = await fetch("/api/billing/change", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan, period: annual ? "ANNUAL" : "MONTHLY" }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(null);
    if (json.ok) {
      setMsg("Plan actualizado.");
      router.refresh();
    } else {
      setMsg(json.error ?? "No se pudo cambiar el plan.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="inline-flex items-center gap-1 rounded-full border bg-white p-1 text-sm">
          <button
            onClick={() => setAnnual(false)}
            className={`rounded-full px-4 py-1.5 font-medium ${!annual ? "bg-primary text-white" : "text-muted-foreground"}`}
          >
            Mensual
          </button>
          <button
            onClick={() => setAnnual(true)}
            className={`rounded-full px-4 py-1.5 font-medium ${annual ? "bg-primary text-white" : "text-muted-foreground"}`}
          >
            Anual (2 meses gratis)
          </button>
        </div>
        {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {PLAN_ORDER.map((tier) => {
          const def = PLANS[tier];
          const isCurrent = tier === currentPlan;
          const total = annualTotal(def.monthly);
          return (
            <Card key={tier} className={isCurrent ? "border-primary" : ""}>
              <CardContent className="flex h-full flex-col py-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{def.name}</h3>
                  {isCurrent && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                      Actual
                    </span>
                  )}
                </div>
                <div className="mt-3">
                  {def.monthly === 0 ? (
                    <span className="text-3xl font-bold">$0</span>
                  ) : annual ? (
                    <>
                      <span className="text-3xl font-bold">${total}</span>
                      <span className="text-muted-foreground"> /año</span>
                    </>
                  ) : (
                    <>
                      <span className="text-3xl font-bold">${def.monthly}</span>
                      <span className="text-muted-foreground"> /mes</span>
                    </>
                  )}
                </div>
                <ul className="mt-4 flex-1 space-y-1.5 text-sm">
                  {FEATURES[tier].map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      {f}
                    </li>
                  ))}
                  <li className="pt-1 text-xs text-muted-foreground">
                    Proyectos: {limitLabel(def.maxProjects)} · Usuarios:{" "}
                    {limitLabel(def.maxMembers)}
                  </li>
                </ul>
                <Button
                  className="mt-5 w-full"
                  variant={isCurrent ? "outline" : "default"}
                  disabled={isCurrent || busy !== null}
                  onClick={() => change(tier)}
                >
                  {isCurrent ? "Plan actual" : busy === tier ? "Cambiando..." : `Cambiar a ${def.name}`}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Sin credenciales de Mercado Pago / PayPal, el cambio de plan se aplica al
        instante (modo demo). Con credenciales, el botón abre el checkout real.
      </p>

      {payFor && (
        <PaymentModal
          plan={payFor}
          period={annual ? "ANNUAL" : "MONTHLY"}
          onClose={() => setPayFor(null)}
        />
      )}
    </div>
  );
}
