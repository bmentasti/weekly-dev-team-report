"use client";

import { useEffect } from "react";

/**
 * Mejora progresiva: aplica transiciones de entrada al hacer scroll a cada
 * sección de la landing (estilo reporting.dev), sin tocar el markup de la
 * página. Solo se ejecuta en cliente:
 *
 *  - No oculta el contenido ya visible al cargar (evita el "flash").
 *  - Solo anima el contenido que está por debajo del fold.
 *  - Escalona (stagger) los hijos directos de cada sección.
 *  - Respeta prefers-reduced-motion (no anima).
 *  - Revela una sola vez por elemento (unobserve tras aparecer).
 */
export function LandingScrollReveal() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || typeof IntersectionObserver === "undefined") return;

    const root = document.getElementById("landing-root");
    if (!root) return;

    const sections = Array.from(root.querySelectorAll<HTMLElement>("section"));
    const foldGuard = window.innerHeight * 0.85;
    const targets: HTMLElement[] = [];

    // Direcciones que se alternan sección a sección para un efecto dinámico
    // (izquierda → arriba → derecha → arriba → …), estilo reporting.dev.
    const DIRECTIONS = ["left", "up", "right", "up"] as const;
    let animatedSectionIdx = 0;

    sections.forEach((section, sectionIdx) => {
      // El hero (primera sección) está sobre el fold: no lo animamos.
      if (sectionIdx === 0) return;

      const dir = DIRECTIONS[animatedSectionIdx % DIRECTIONS.length];
      animatedSectionIdx++;

      // Hijos directos "de contenido" (saltamos blobs decorativos).
      const children = Array.from(section.children).filter(
        (c): c is HTMLElement =>
          c instanceof HTMLElement &&
          !c.classList.contains("pointer-events-none"),
      );

      children.forEach((el, childIdx) => {
        const rect = el.getBoundingClientRect();
        // Ya visible al cargar => dejarlo tal cual (sin animación, sin flash).
        if (rect.top < foldGuard) return;

        el.classList.add("reveal", `reveal-${dir}`);
        if (childIdx > 0) {
          el.style.setProperty("--reveal-delay", `${Math.min(childIdx, 4) * 90}ms`);
        }
        targets.push(el);
      });
    });

    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );

    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return null;
}
