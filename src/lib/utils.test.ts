import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("combina clases", () => {
    expect(cn("a", "b")).toBe("a b");
  });
  it("resuelve condicionales y falsy", () => {
    expect(cn("a", false && "b", null, undefined, "c")).toBe("a c");
  });
  it("hace merge de tailwind (última gana)", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});
