import { addRecurrence, deleteRecurrence, toggleRecurrence } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { getI18n } from "@/i18n";
import { formatDay } from "@/lib/dates";
import { requireHousehold } from "@/lib/household";
import { categoryName, formatAmount } from "@/lib/money";
import { CURRENCIES, type Category, type Recurrence } from "@/lib/types";

export default async function RecurrencesPage({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const { t, locale } = await getI18n();
  const { supabase, household } = await requireHousehold();
  const { erreur } = await searchParams;
  const [{ data: recs }, { data: categories }] = await Promise.all([
    supabase.from("recurrences").select("*").eq("household_id", household.id).order("day_of_month"),
    supabase.from("categories").select("*").eq("household_id", household.id).eq("archived", false).order("name_fr"),
  ]);
  const cats = (categories ?? []) as Category[];
  const cat = new Map(cats.map((c) => [c.id, c]));
  const list = (recs ?? []) as Recurrence[];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">{t.recurrences.title}</h2>
        <p className="text-sm text-muted">{t.recurrences.hint}</p>
      </div>

      <section className="card">
        {list.length === 0 ? (
          <p className="text-sm text-muted">{t.recurrences.empty}</p>
        ) : (
          <ul className="divide-y divide-border">
            {list.map((r) => (
              <li key={r.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 ${r.active ? "" : "opacity-50"}`}>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.label}</p>
                  <p className="text-xs text-muted">
                    {categoryName(r.category_id ? cat.get(r.category_id) : undefined, locale)} · {t.recurrences.next} {formatDay(r.next_on, locale)}
                  </p>
                </div>
                <span className="font-semibold tabular-nums" dir="ltr">{formatAmount(Number(r.amount), r.currency, locale)}</span>
                <form action={toggleRecurrence}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="active" value={String(!r.active)} />
                  <input type="hidden" name="day_of_month" value={r.day_of_month} />
                  <button type="submit" className="btn-ghost">{r.active ? t.recurrences.pause : t.recurrences.resume}</button>
                </form>
                <form action={deleteRecurrence}>
                  <input type="hidden" name="id" value={r.id} />
                  <button type="submit" className="btn-danger">{t.recurrences.delete}</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form action={addRecurrence} className="card grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="label" htmlFor="label">{t.recurrences.label}</label>
          <input className="input" id="label" name="label" required maxLength={80} />
        </div>
        <div>
          <label className="label" htmlFor="amount">{t.tx.amount}</label>
          <input className="input tabular-nums" id="amount" name="amount" inputMode="decimal" required dir="ltr" />
          {erreur && <p className="mt-1 text-sm text-danger">{t.common.required}</p>}
        </div>
        <div>
          <label className="label" htmlFor="currency">{t.tx.currency}</label>
          <select className="input" id="currency" name="currency" defaultValue={household.reference_currency}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="day_of_month">{t.recurrences.dayOfMonth}</label>
          <input className="input" id="day_of_month" name="day_of_month" type="number" min={1} max={31} defaultValue={1} required />
        </div>
        <div>
          <label className="label" htmlFor="kind">{t.categories.kind}</label>
          <select className="input" id="kind" name="kind">
            <option value="expense">{t.tx.expense}</option>
            <option value="income">{t.tx.incomeKind}</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="category_id">{t.tx.category}</label>
          <select className="input" id="category_id" name="category_id">
            {cats.map((c) => <option key={c.id} value={c.id}>{categoryName(c, locale)}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="visibility">{t.tx.visibility}</label>
          <select className="input" id="visibility" name="visibility">
            <option value="shared">{t.tx.shared}</option>
            <option value="personal">{t.tx.personal}</option>
          </select>
        </div>
        <div className="col-span-2">
          <SubmitButton>{t.recurrences.add}</SubmitButton>
        </div>
      </form>
    </div>
  );
}
