import { addCategory, archiveCategory } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { getI18n } from "@/i18n";
import { requireHousehold } from "@/lib/household";
import { categoryName } from "@/lib/money";
import type { Category } from "@/lib/types";

export default async function CategoriesPage() {
  const { t, locale } = await getI18n();
  const { supabase, household } = await requireHousehold();
  const { data } = await supabase
    .from("categories")
    .select("*")
    .eq("household_id", household.id)
    .eq("archived", false)
    .order("kind")
    .order("name_fr");
  const cats = (data ?? []) as Category[];

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{t.categories.title}</h2>
      <ul className="card divide-y divide-border py-1">
        {cats.map((c) => (
          <li key={c.id} className="flex items-center gap-3 py-2">
            <span className="h-3 w-3 rounded-full" style={{ background: c.color }} />
            <span className="flex-1">{categoryName(c, locale)}</span>
            <span className="text-xs text-muted">{c.kind === "income" ? t.tx.incomeKind : t.tx.expense}</span>
            <form action={archiveCategory}>
              <input type="hidden" name="id" value={c.id} />
              <button type="submit" className="btn-danger">{t.categories.archive}</button>
            </form>
          </li>
        ))}
      </ul>
      <form action={addCategory} className="card grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="name_fr">{t.categories.nameFr}</label>
          <input className="input" id="name_fr" name="name_fr" required maxLength={60} dir="ltr" />
        </div>
        <div>
          <label className="label" htmlFor="name_ar">{t.categories.nameAr}</label>
          <input className="input" id="name_ar" name="name_ar" maxLength={60} dir="rtl" />
        </div>
        <div>
          <label className="label" htmlFor="kind">{t.categories.kind}</label>
          <select className="input" id="kind" name="kind">
            <option value="expense">{t.tx.expense}</option>
            <option value="income">{t.tx.incomeKind}</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="color">{t.categories.color}</label>
          <input className="input h-[42px] p-1" id="color" name="color" type="color" defaultValue="#0f766e" />
        </div>
        <div className="col-span-2">
          <SubmitButton>{t.categories.add}</SubmitButton>
        </div>
      </form>
    </div>
  );
}
