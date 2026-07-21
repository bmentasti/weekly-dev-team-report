import { describe, it, expect } from "vitest";
import { PERSON_CATEGORY_LABEL, personCategoryVariant } from "./labels";
import type { PersonCategory } from "./types";

describe("labels", () => {
  it("tiene label para cada categoría", () => {
    const cats: PersonCategory[] = [
      "RECOGNIZE",
      "SUPPORT",
      "OVERLOADED",
      "FREE_CAPACITY",
      "ON_TRACK",
      "INSUFFICIENT_DATA",
    ];
    for (const c of cats) expect(PERSON_CATEGORY_LABEL[c]).toBeTruthy();
  });
  it("personCategoryVariant cubre todos los casos", () => {
    expect(personCategoryVariant("RECOGNIZE")).toBe("success");
    expect(personCategoryVariant("SUPPORT")).toBe("warning");
    expect(personCategoryVariant("OVERLOADED")).toBe("destructive");
    expect(personCategoryVariant("FREE_CAPACITY")).toBe("info");
    expect(personCategoryVariant("ON_TRACK")).toBe("secondary");
    expect(personCategoryVariant("INSUFFICIENT_DATA")).toBe("secondary");
  });
});
