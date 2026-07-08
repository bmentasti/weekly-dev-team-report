// Heurística compartida para detectar posibles blockers en mensajes.
// Sin \b final: los stems (bloque, trab(a|á)d, impedi) deben matchear también
// las formas con sufijo (bloqueado, trabado, impedimento). El \b inicial evita
// falsos positivos en medio de palabra (ej. "desbloqueado" no matchea).
export const BLOCKER_PATTERN =
  /\b(blocker|blocked|blocking|bloque|stuck|trab(a|á)d|impedi|no puedo avanzar|can'?t proceed|waiting on|esperando a)/i;

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
