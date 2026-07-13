import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type DateInput = Date | string | number | null | undefined;

function toDate(value: DateInput): Date | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Formatea una fecha como DD/MM/AAAA (formato usado en toda la plataforma).
 * Devuelve "" si la fecha es inválida o nula.
 */
export function formatDate(value: DateInput): string {
  const d = toDate(value);
  if (!d) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Formatea fecha y hora como DD/MM/AAAA HH:mm (24 h).
 * Devuelve "" si la fecha es inválida o nula.
 */
export function formatDateTime(value: DateInput): string {
  const d = toDate(value);
  if (!d) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${formatDate(d)} ${hh}:${min}`;
}
