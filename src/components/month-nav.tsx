import Link from "next/link";
import { formatMonth, shiftMonth } from "@/lib/dates";

export function MonthNav({ month, path, locale }: { month: string; path: string; locale: "fr" | "ar" }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Link className="btn-ghost" href={`${path}?mois=${shiftMonth(month, -1)}`} aria-label="-1">
        <span className="rtl:rotate-180">‹</span>
      </Link>
      <h2 className="text-lg font-semibold capitalize">{formatMonth(month, locale)}</h2>
      <Link className="btn-ghost" href={`${path}?mois=${shiftMonth(month, 1)}`} aria-label="+1">
        <span className="rtl:rotate-180">›</span>
      </Link>
    </div>
  );
}
