import { MonthNav } from "@/components/month-nav";
import { TransactionList } from "@/components/transaction-list";
import { getI18n } from "@/i18n";
import { monthRange, parseMonth } from "@/lib/dates";
import { requireHousehold } from "@/lib/household";
import type { Category, Transaction } from "@/lib/types";

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<{ mois?: string }> }) {
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

  return (
    <div className="flex flex-col gap-4">
      <MonthNav month={month} path="/depenses" locale={locale} />
      <section className="card">
        {list.length === 0 ? (
          <p className="text-sm text-muted">{t.tx.empty}</p>
        ) : (
          <TransactionList
            txs={list}
            categories={(categories ?? []) as Category[]}
            members={members}
            locale={locale}
            t={t}
            canDelete
          />
        )}
      </section>
    </div>
  );
}
