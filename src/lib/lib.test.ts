import { describe, expect, it } from "vitest";
import { ar } from "../i18n/ar";
import { fr } from "../i18n/fr";
import { firstOccurrence, monthRange, parseMonth, shiftMonth } from "./dates";
import { monthTotals, parseAmount } from "./money";

describe("parseAmount", () => {
  it("accepte virgule, point et espaces", () => {
    expect(parseAmount("12,5")).toBe(12.5);
    expect(parseAmount("1 234.750")).toBe(1234.75);
    expect(parseAmount("7")).toBe(7);
  });
  it("refuse les montants invalides ou nuls", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("0")).toBeNull();
    expect(parseAmount("-3")).toBeNull();
    expect(parseAmount("1.2345")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
  });
});

describe("dates", () => {
  it("lit le mois de l'URL ou prend le mois courant", () => {
    expect(parseMonth("2026-02")).toBe("2026-02");
    expect(parseMonth("2026-13", new Date(2026, 10, 18))).toBe("2026-11");
    expect(parseMonth(undefined, new Date(2026, 0, 3))).toBe("2026-01");
  });
  it("calcule les bornes et décale les mois", () => {
    expect(monthRange("2026-12")).toEqual({ start: "2026-12-01", end: "2027-01-01" });
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });
  it("place la première échéance d'une récurrence", () => {
    expect(firstOccurrence(25, new Date(2026, 10, 18))).toBe("2026-11-25");
    expect(firstOccurrence(5, new Date(2026, 10, 18))).toBe("2026-12-05");
    expect(firstOccurrence(31, new Date(2026, 1, 10))).toBe("2026-02-28");
    expect(firstOccurrence(1, new Date(2026, 11, 2))).toBe("2027-01-01");
  });
});

describe("monthTotals", () => {
  it("additionne par type et par catégorie et signale les montants non convertis", () => {
    const totals = monthTotals([
      { kind: "expense", amount_reference: 10, category_id: "a" },
      { kind: "expense", amount_reference: 30, category_id: "b" },
      { kind: "expense", amount_reference: 5, category_id: "a" },
      { kind: "income", amount_reference: 100, category_id: "s" },
      { kind: "expense", amount_reference: null, category_id: "a" },
    ]);
    expect(totals.expense).toBe(45);
    expect(totals.income).toBe(100);
    expect(totals.unconverted).toBe(1);
    expect(totals.byCategory).toEqual([
      { categoryId: "b", total: 30 },
      { categoryId: "a", total: 15 },
    ]);
  });
});

describe("traductions", () => {
  const keys = (o: object, prefix = ""): string[] =>
    Object.entries(o).flatMap(([k, v]) => (typeof v === "string" ? [prefix + k] : keys(v, `${prefix}${k}.`)));
  it("l'arabe couvre exactement les clés du français", () => {
    expect(keys(ar).sort()).toEqual(keys(fr).sort());
  });
});
