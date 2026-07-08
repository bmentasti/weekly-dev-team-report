"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

type Direction = "up" | "left" | "right" | "scale";

interface RevealProps {
  children: ReactNode;
  /** Dirección de la animación de entrada. Default: "up". */
  direction?: Direction;
  /** Retardo en ms para escalonar (stagger) elementos de una misma fila. */
  delay?: number;
  className?: string;
}

/**
 * Envuelve contenido y lo revela con una transición suave cuando entra en el
 * viewport (estilo reporting.dev). Usa IntersectionObserver, respeta
 * prefers-reduced-motion (vía CSS) y solo anima una vez.
 *
 * Nota: la landing usa además <LandingScrollReveal /> como mejora progresiva
 * global; este componente queda disponible para animar bloques puntuales.
 */
export function Reveal({
  children,
  direction = "up",
  delay = 0,
  className,
}: RevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn("reveal", `reveal-${direction}`, visible && "is-visible", className)}
      style={delay ? ({ "--reveal-delay": `${delay}ms` } as CSSProperties) : undefined}
    >
      {children}
    </div>
  );
}
