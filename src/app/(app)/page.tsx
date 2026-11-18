import { MonthNav } from "@/components/month-nav";
import { TransactionList } from "@/components/transaction-list";
import { getI18n } from "@/i18n";
import { monthRange, parseMonth } from "@/lib/dates";
import { requireHousehold } from "@/lib/household";
import { categoryName, formatAmount, monthTotals } from "@/lib/money";
import type { Category, Transaction } from "@/lib/types";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ mois?: string }> }) {
  const { t, locale } = await getI18n();
  const { supabase, household, members } = await requireHousehold();
  const month = parseMonth((await searchParams).mois);
  const { start, end } = monthRange(month);

  const [{ data: txs }, { data: categories }] = await Promise.all([
    supabase
      .from("transactions")
      .select("*")
      .eq("household_id", household.id)
      .gte("occurred_on", start)
      .lt("occurred_on", end)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("categories").select("*").eq("household_id", household.id),
  ]);
  const list = (txs ?? []) as Transaction[];
  const cats = (categories ?? []) as Category[];
  const cat = new Map(cats.map((c) => [c.id, c]));
  const totals = monthTotals(list);
  const ref = household.reference_currency;
  const max = totals.byCategory[0]?.total ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <MonthNav month={month} path="/" locale={locale} />

      <section className="grid grid-cols-3 gap-2">
        {[
          { label: t.dashboard.spent, value: totals.expense },
          { label: t.dashboard.income, value: totals.income },
          { label: t.dashboard.balance, value: totals.income - totals.expense },
        ].map((k) => (
          <div key={k.label} className="card p-3">
            <p className="text-xs text-muted">{k.label}</p>
            <p className="mt-1 text-base font-bold tabular-nums sm:text-xl" dir="ltr">{formatAmount(k.value, ref, locale)}</p>
          </div>
        ))}
      </section>

      {totals.unconverted > 0 && (
        <p className="rounded-lg bg-danger/10 p-3 text-sm text-danger">{t.dashboard.missingRate}</p>
      )}

      <section className="card">
        <h3 className="mb-3 font-semibold">{t.dashboard.byCategory}</h3>
        {totals.byCategory.length === 0 ? (
          <p className="text-sm text-muted">{t.dashboard.empty}</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {totals.byCategory.map((row) => {
              const c = row.categoryId ? cat.get(row.categoryId) : undefined;
              return (
                <li key={row.categoryId ?? "none"}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{categoryName(c, locale)}</span>
                    <span className="tabular-nums" dir="ltr">{formatAmount(row.total, ref, locale)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-border">
                    <div
                      className="h-2 rounded-full"
                      style={{ width: `${max ? (row.total / max) * 100 : 0}%`, background: c?.color ?? "#94a3b8" }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card">
        <h3 className="mb-1 font-semibold">{t.dashboard.recent}</h3>
        {list.length === 0 ? (
          <p className="text-sm text-muted">{t.dashboard.empty}</p>
        ) : (
          <TransactionList txs={list.slice(0, 8)} categories={cats} members={members} locale={locale} t={t} />
        )}
      </section>
    </div>
  );
}
