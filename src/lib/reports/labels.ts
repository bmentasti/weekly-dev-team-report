import type { PersonCategory } from "./types";

export const PERSON_CATEGORY_LABEL: Record<PersonCategory, string> = {
  RECOGNIZE: "Reconocer",
  SUPPORT: "Necesita apoyo",
  OVERLOADED: "Sobrecargado/a",
  FREE_CAPACITY: "Capacidad libre",
  ON_TRACK: "En ritmo",
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
    default:
      return "secondary";
  }
}
