"use client";

import { useEffect, useState } from "react";

const WORDS = ["Tech Leads", "Product Owners", "Directores", "Scrum Masters"];

/**
 * Headline animado estilo SaaS: un prefijo fijo + una palabra que rota
 * con efecto typewriter y cursor parpadeante. Inspirado en el hero de
 * plataformas como Tiendanube.
 */
export function RotatingHeadline() {
  const [index, setIndex] = useState(0);
  const [text, setText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const full = WORDS[index];
    let delay = deleting ? 45 : 95;

    if (!deleting && text === full) {
      delay = 1400; // pausa al completar la palabra
    } else if (deleting && text === "") {
      delay = 250;
    }

    const t = setTimeout(() => {
      if (!deleting && text === full) {
        setDeleting(true);
      } else if (deleting && text === "") {
        setDeleting(false);
        setIndex((i) => (i + 1) % WORDS.length);
      } else {
        setText(
          full.substring(0, deleting ? text.length - 1 : text.length + 1),
        );
      }
    }, delay);

    return () => clearTimeout(t);
  }, [text, deleting, index]);

  return (
    <span className="text-primary">
      {text}
      <span className="animate-caret font-normal text-primary/80">|</span>
    </span>
  );
}
