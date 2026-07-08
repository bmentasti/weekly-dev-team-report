"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ConfirmOpts {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}
interface PromptOpts {
  title: string;
  label?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
}
interface AlertOpts {
  title: string;
  description?: string;
}
interface UpgradeOpts {
  feature: string;
  suggestedPlan?: "Team" | "Pro";
}

type Dialogs = {
  confirm: (o: ConfirmOpts) => Promise<boolean>;
  prompt: (o: PromptOpts) => Promise<string | null>;
  alert: (o: AlertOpts) => Promise<void>;
  upgrade: (o: UpgradeOpts) => Promise<void>;
};

const DialogCtx = createContext<Dialogs | null>(null);

export function useDialogs(): Dialogs {
  const ctx = useContext(DialogCtx);
  if (!ctx) throw new Error("useDialogs debe usarse dentro de DialogProvider");
  return ctx;
}

type State =
  | { kind: "confirm"; opts: ConfirmOpts; resolve: (v: boolean) => void }
  | { kind: "prompt"; opts: PromptOpts; resolve: (v: string | null) => void }
  | { kind: "alert"; opts: AlertOpts; resolve: () => void }
  | { kind: "upgrade"; opts: UpgradeOpts; resolve: () => void }
  | null;

function Shell({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy/50" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-card border bg-background p-6 shadow-card">
        <h2 className="text-lg font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<State>(null);
  const [promptValue, setPromptValue] = useState("");

  const confirm = useCallback(
    (opts: ConfirmOpts) =>
      new Promise<boolean>((resolve) => setState({ kind: "confirm", opts, resolve })),
    [],
  );
  const prompt = useCallback(
    (opts: PromptOpts) =>
      new Promise<string | null>((resolve) => {
        setPromptValue(opts.defaultValue ?? "");
        setState({ kind: "prompt", opts, resolve });
      }),
    [],
  );
  const alert = useCallback(
    (opts: AlertOpts) =>
      new Promise<void>((resolve) => setState({ kind: "alert", opts, resolve })),
    [],
  );
  const upgrade = useCallback(
    (opts: UpgradeOpts) =>
      new Promise<void>((resolve) => setState({ kind: "upgrade", opts, resolve })),
    [],
  );

  function close() {
    setState(null);
  }

  return (
    <DialogCtx.Provider value={{ confirm, prompt, alert, upgrade }}>
      {children}

      {state?.kind === "confirm" && (
        <Shell
          title={state.opts.title}
          onClose={() => {
            state.resolve(false);
            close();
          }}
        >
          {state.opts.description && (
            <p className="mt-2 text-sm text-muted-foreground">
              {state.opts.description}
            </p>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                state.resolve(false);
                close();
              }}
            >
              {state.opts.cancelLabel ?? "Cancelar"}
            </Button>
            <Button
              variant={state.opts.danger ? "destructive" : "default"}
              onClick={() => {
                state.resolve(true);
                close();
              }}
            >
              {state.opts.confirmLabel ?? "Confirmar"}
            </Button>
          </div>
        </Shell>
      )}

      {state?.kind === "prompt" && (
        <Shell
          title={state.opts.title}
          onClose={() => {
            state.resolve(null);
            close();
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              state.resolve(promptValue.trim() ? promptValue.trim() : null);
              close();
            }}
          >
            {state.opts.label && (
              <label className="mt-4 block text-sm font-medium">
                {state.opts.label}
              </label>
            )}
            <Input
              autoFocus
              className="mt-2"
              value={promptValue}
              placeholder={state.opts.placeholder}
              onChange={(e) => setPromptValue(e.target.value)}
            />
            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  state.resolve(null);
                  close();
                }}
              >
                Cancelar
              </Button>
              <Button type="submit">
                {state.opts.confirmLabel ?? "Guardar"}
              </Button>
            </div>
          </form>
        </Shell>
      )}

      {state?.kind === "alert" && (
        <Shell
          title={state.opts.title}
          onClose={() => {
            state.resolve();
            close();
          }}
        >
          {state.opts.description && (
            <p className="mt-2 text-sm text-muted-foreground">
              {state.opts.description}
            </p>
          )}
          <div className="mt-6 flex justify-end">
            <Button
              onClick={() => {
                state.resolve();
                close();
              }}
            >
              Entendido
            </Button>
          </div>
        </Shell>
      )}

      {state?.kind === "upgrade" && (
        <Shell
          title={`Mejorá a ${state.opts.suggestedPlan ?? "Team"}`}
          onClose={() => {
            state.resolve();
            close();
          }}
        >
          <p className="mt-2 text-sm text-muted-foreground">
            {state.opts.feature} está disponible en el plan{" "}
            <span className="font-medium text-foreground">
              {state.opts.suggestedPlan ?? "Team"}
            </span>
            . Mejorá tu plan para desbloquearlo.
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                state.resolve();
                close();
              }}
            >
              Ahora no
            </Button>
            <Button
              onClick={() => {
                state.resolve();
                close();
                router.push("/settings");
              }}
            >
              Ver planes
            </Button>
          </div>
        </Shell>
      )}
    </DialogCtx.Provider>
  );
}
