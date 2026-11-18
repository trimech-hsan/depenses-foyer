import type { Category, Currency, Transaction } from "./types";

const DECIMALS: Record<Currency, number> = { TND: 3, EUR: 2 };

/** Formate un montant selon la langue : « 1 234,500 TND » ou « ١٬٢٣٤٫٥٠٠ د.ت. ». */
export function formatAmount(amount: number, currency: Currency, locale: "fr" | "ar"): string {
  return new Intl.NumberFormat(locale === "ar" ? "ar-TN" : "fr-FR", {
    style: "currency",
    currency,
    minimumFractionDigits: DECIMALS[currency],
    maximumFractionDigits: DECIMALS[currency],
  }).format(amount);
}

/** Lit un montant saisi à la main : accepte la virgule ou le point décimal et les espaces. */
export function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[\s  ]/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,3})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return value > 0 ? value : null;
}

export interface MonthTotals {
  expense: number;
  income: number;
  /** Opérations sans taux de change, donc exclues des totaux. */
  unconverted: number;
  byCategory: { categoryId: string | null; total: number }[];
}

/** Totaux du mois en devise de référence (amount_reference calculé par la base). */
export function monthTotals(
  txs: Pick<Transaction, "kind" | "amount_reference" | "category_id">[],
): MonthTotals {
  let expense = 0;
  let income = 0;
  let unconverted = 0;
  const perCategory = new Map<string | null, number>();
  for (const tx of txs) {
    if (tx.amount_reference == null) {
      unconverted += 1;
      continue;
    }
    const value = Number(tx.amount_reference);
    if (tx.kind === "income") {
      income += value;
    } else {
      expense += value;
      perCategory.set(tx.category_id, (perCategory.get(tx.category_id) ?? 0) + value);
    }
  }
  const byCategory = [...perCategory.entries()]
    .map(([categoryId, total]) => ({ categoryId, total }))
    .sort((a, b) => b.total - a.total);
  return { expense, income, unconverted, byCategory };
}

export function categoryName(category: Pick<Category, "name_fr" | "name_ar"> | undefined, locale: "fr" | "ar"): string {
  if (!category) return "—";
  return locale === "ar" && category.name_ar ? category.name_ar : category.name_fr;
}
