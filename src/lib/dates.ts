/** Mois au format AAAA-MM, à partir d'un paramètre d'URL ou de la date du jour. */
export function parseMonth(raw: string | undefined, today = new Date()): string {
  if (raw && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw)) return raw;
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

/** Premier jour du mois et premier jour du mois suivant (borne exclue). */
export function monthRange(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return { start: `${month}-01`, end: `${next}-01` };
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const index = y * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

export function formatMonth(month: string, locale: "fr" | "ar"): string {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-TN" : "fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}

export function formatDay(date: string, locale: "fr" | "ar"): string {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-TN" : "fr-FR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

export function todayIso(today = new Date()): string {
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

/** Première date d'échéance d'une récurrence : ce mois-ci si le jour n'est pas passé, sinon le mois suivant. */
export function firstOccurrence(dayOfMonth: number, today = new Date()): string {
  const clamp = (y: number, m: number) => Math.min(dayOfMonth, new Date(Date.UTC(y, m + 1, 0)).getUTCDate());
  let y = today.getFullYear();
  let m = today.getMonth();
  if (clamp(y, m) < today.getDate()) {
    m += 1;
    if (m === 12) {
      m = 0;
      y += 1;
    }
  }
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(clamp(y, m)).padStart(2, "0")}`;
}
