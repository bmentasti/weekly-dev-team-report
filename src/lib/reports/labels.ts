import type { PersonCategory } from "./types";

export const PERSON_CATEGORY_LABEL: Record<PersonCategory, string> = {
  RECOGNIZE: "Avance sólido",
  SUPPORT: "Necesita apoyo",
  OVERLOADED: "Sobrecargado/a",
  FREE_CAPACITY: "Capacidad libre",
  ON_TRACK: "En seguimiento",
  INSUFFICIENT_DATA: "Datos insuficientes",
};

export function personCategoryVariant(
  c: PersonCategory,
): "success" | "warning" | "destructive" | "info" | "secondary" {
  switch (c) {
    case "RECOGNIZE":
      return "success";
    case "SUPPORT":
      return "warning";
    case "OVERLOADED":
      return "destructive";
    case "FREE_CAPACITY":
      return "info";
    case "INSUFFICIENT_DATA":
      return "secondary";
    default:
      return "secondary";
  }
}
