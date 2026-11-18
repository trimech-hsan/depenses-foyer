import Link from "next/link";
import { signOut } from "@/app/actions";
import { LanguageSwitch } from "@/components/language-switch";
import { getI18n } from "@/i18n";
import { requireHousehold } from "@/lib/household";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { t } = await getI18n();
  const { supabase, household } = await requireHousehold();
  // Crée les opérations récurrentes arrivées à échéance (loyer, abonnements…).
  await supabase.rpc("generate_due_recurrences", { p_household_id: household.id });

  const links = [
    { href: "/", label: t.nav.dashboard },
    { href: "/depenses", label: t.nav.transactions },
    { href: "/depenses/nouvelle", label: t.nav.add, primary: true },
    { href: "/recurrences", label: t.nav.recurrences },
    { href: "/foyer", label: t.nav.household },
  ];

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col">
      <header className="flex items-center justify-between gap-2 px-4 py-3">
        <Link href="/" className="truncate text-lg font-bold">{household.name}</Link>
        <div className="flex items-center gap-2">
          <Link href="/categories" className="btn-ghost">{t.nav.categories}</Link>
          <LanguageSwitch />
          <form action={signOut}>
            <button className="btn-ghost" type="submit">{t.nav.signOut}</button>
          </form>
        </div>
      </header>
      <main className="flex-1 px-4 pb-28">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]">
        <ul className="mx-auto flex max-w-3xl items-stretch justify-around">
          {links.map((l) => (
            <li key={l.href} className="flex-1">
              <Link
                href={l.href}
                className={
                  l.primary
                    ? "m-1.5 flex items-center justify-center rounded-full bg-accent py-2 text-sm font-semibold text-accent-contrast"
                    : "flex items-center justify-center py-3.5 text-sm"
                }
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
