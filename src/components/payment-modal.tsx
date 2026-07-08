"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  PLANS,
  annualTotal,
  type PlanTierName,
  type BillingPeriodName,
} from "@/lib/plans";

export function PaymentModal({
  plan,
  period,
  onClose,
}: {
  plan: PlanTierName;
  period: BillingPeriodName;
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const def = PLANS[plan];
  const amount = period === "ANNUAL" ? annualTotal(def.monthly) : def.monthly;

  async function pay(provider: "mercadopago" | "paypal") {
    setBusy(provider);
    setError(null);
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan, period, provider }),
    });
    const json = await res.json().catch(() => ({}));
    if (json.redirectUrl) {
      window.location.href = json.redirectUrl;
      return;
    }
    setBusy(null);
    if (json.ok) {
      onClose();
      router.refresh();
    } else {
      setError(json.error ?? "No se pudo iniciar el pago.");
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy/50" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-card border bg-background p-6 shadow-card">
        <h2 className="text-lg font-semibold">Pasar a {def.name}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {period === "ANNUAL"
            ? `US$${amount}/año (2 meses gratis)`
            : `US$${amount}/mes`}{" "}
          · usuarios incluidos según el plan.
        </p>

        {error && (
          <p className="mt-4 rounded-input bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="mt-6 space-y-2">
          <Button
            className="w-full"
            disabled={busy !== null}
            onClick={() => pay("mercadopago")}
          >
            {busy === "mercadopago" ? "Redirigiendo..." : "Pagar con Mercado Pago"}
          </Button>
          <Button
            variant="outline"
            className="w-full"
            disabled={busy !== null}
            onClick={() => pay("paypal")}
          >
            {busy === "paypal" ? "Redirigiendo..." : "Pagar con PayPal"}
          </Button>
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
        >
          Cancelar
        </button>

        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          Sin credenciales del proveedor, el cambio se aplica en modo demo.
        </p>
      </div>
    </div>
  );
}
