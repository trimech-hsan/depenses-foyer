import { deleteTransaction } from "@/app/actions";
import type { Dictionary } from "@/i18n/fr";
import { formatDay } from "@/lib/dates";
import { categoryName, formatAmount } from "@/lib/money";
import type { Category, Member, Transaction } from "@/lib/types";

export function TransactionList({
  txs,
  categories,
  members,
  locale,
  t,
  canDelete = false,
}: {
  txs: Transaction[];
  categories: Category[];
  members: Member[];
  locale: "fr" | "ar";
  t: Dictionary;
  canDelete?: boolean;
}) {
  const cat = new Map(categories.map((c) => [c.id, c]));
  const who = new Map(members.map((m) => [m.user_id, m.display_name]));
  return (
    <ul className="divide-y divide-border">
      {txs.map((tx) => {
        const c = tx.category_id ? cat.get(tx.category_id) : undefined;
        return (
          <li key={tx.id} className="flex items-center gap-3 py-2.5">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: c?.color ?? "#94a3b8" }} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{tx.note || categoryName(c, locale)}</p>
              <p className="truncate text-xs text-muted">
                {formatDay(tx.occurred_on, locale)} · {categoryName(c, locale)}
                {tx.paid_by && who.get(tx.paid_by) ? ` · ${who.get(tx.paid_by)}` : ""}
                {!tx.is_shared ? ` · ${t.tx.personal.split(" ")[0]}` : ""}
              </p>
            </div>
            <span className={`whitespace-nowrap font-semibold tabular-nums ${tx.kind === "income" ? "text-accent" : ""}`} dir="ltr">
              {tx.kind === "income" ? "+" : "−"}
              {formatAmount(Number(tx.amount), tx.currency, locale)}
            </span>
            {canDelete && (
              <form action={deleteTransaction}>
                <input type="hidden" name="id" value={tx.id} />
                <button type="submit" className="btn-danger" aria-label={t.tx.delete} title={t.tx.delete}>×</button>
              </form>
            )}
          </li>
        );
      })}
    </ul>
  );
}
