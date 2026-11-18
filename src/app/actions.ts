"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { isLocale, LOCALE_COOKIE } from "@/i18n";
import { firstOccurrence } from "@/lib/dates";
import { requireHousehold } from "@/lib/household";
import { parseAmount } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { CURRENCIES, type Currency } from "@/lib/types";

const str = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const currencyOf = (value: string): Currency => (CURRENCIES.includes(value as Currency) ? (value as Currency) : "TND");
const kindOf = (value: string) => (value === "income" ? "income" : "expense");
const uuidOrNull = (value: string) => (/^[0-9a-f-]{36}$/i.test(value) ? value : null);
const isoDate = (value: string) => (/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null);

/** Ramène à un chemin interne pour éviter les redirections vers un autre site. */
function safeNext(value: string): string {
  return value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

// --- Langue -----------------------------------------------------------------

export async function setLocale(form: FormData) {
  const locale = str(form, "locale");
  if (isLocale(locale)) {
    (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }
  revalidatePath("/", "layout");
}

// --- Authentification -------------------------------------------------------

export async function signIn(form: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: str(form, "email"),
    password: String(form.get("password") ?? ""),
  });
  if (error) redirect("/connexion?erreur=1");
  redirect(safeNext(str(form, "next")));
}

export async function signUp(form: FormData) {
  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? "";
  const next = safeNext(str(form, "next"));
  const { data, error } = await supabase.auth.signUp({
    email: str(form, "email"),
    password: String(form.get("password") ?? ""),
    options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) redirect("/connexion?erreur=1");
  if (!data.session) redirect("/connexion?verifier=1");
  redirect(next);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/connexion");
}

// --- Foyer et invitation ----------------------------------------------------

export async function createHousehold(form: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_household", {
    p_name: str(form, "name") || "Foyer",
    p_display_name: str(form, "display_name") || "Moi",
    p_reference_currency: currencyOf(str(form, "reference_currency")),
  });
  if (error) throw new Error(error.message);
  redirect("/");
}

export async function createInvitation() {
  const { supabase, household } = await requireHousehold();
  const { data, error } = await supabase.rpc("create_invitation", { p_household_id: household.id });
  if (error) throw new Error(error.message);
  redirect(`/foyer?invitation=${data}`);
}

export async function acceptInvitation(form: FormData) {
  const supabase = await createClient();
  const code = str(form, "code");
  const { error } = await supabase.rpc("accept_invitation", {
    p_code: code,
    p_display_name: str(form, "display_name") || "Moi",
  });
  if (error) redirect(`/rejoindre/${encodeURIComponent(code)}?erreur=1`);
  redirect("/");
}

export async function addAccount(form: FormData) {
  const { supabase, household } = await requireHousehold();
  const kind = str(form, "kind");
  const { error } = await supabase.from("accounts").insert({
    household_id: household.id,
    name: str(form, "name"),
    kind: ["bank", "cash", "card", "savings"].includes(kind) ? kind : "bank",
    currency: currencyOf(str(form, "currency")),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/foyer");
}

export async function saveExchangeRate(form: FormData) {
  const { supabase, household } = await requireHousehold();
  const rate = parseAmount(str(form, "rate"));
  const validFrom = isoDate(str(form, "valid_from"));
  if (!rate || !validFrom) return;
  const { error } = await supabase.from("exchange_rates").upsert({
    household_id: household.id,
    currency: currencyOf(str(form, "currency")),
    valid_from: validFrom,
    rate,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

// --- Opérations -------------------------------------------------------------

export async function addTransaction(form: FormData) {
  const { supabase, household, user } = await requireHousehold();
  const amount = parseAmount(str(form, "amount"));
  if (!amount) redirect("/depenses/nouvelle?erreur=montant");
  const occurredOn = isoDate(str(form, "occurred_on"));
  const { error } = await supabase.from("transactions").insert({
    household_id: household.id,
    kind: kindOf(str(form, "kind")),
    amount,
    currency: currencyOf(str(form, "currency")),
    ...(occurredOn ? { occurred_on: occurredOn } : {}),
    category_id: uuidOrNull(str(form, "category_id")),
    account_id: uuidOrNull(str(form, "account_id")),
    paid_by: uuidOrNull(str(form, "paid_by")) ?? user.id,
    is_shared: str(form, "visibility") !== "personal",
    note: str(form, "note").slice(0, 500) || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
  redirect(`/depenses?mois=${(occurredOn ?? "").slice(0, 7)}`);
}

export async function deleteTransaction(form: FormData) {
  const { supabase } = await requireHousehold();
  const id = uuidOrNull(str(form, "id"));
  if (!id) return;
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

// --- Catégories -------------------------------------------------------------

export async function addCategory(form: FormData) {
  const { supabase, household } = await requireHousehold();
  const color = str(form, "color");
  const { error } = await supabase.from("categories").insert({
    household_id: household.id,
    name_fr: str(form, "name_fr"),
    name_ar: str(form, "name_ar") || null,
    kind: kindOf(str(form, "kind")),
    color: /^#[0-9a-f]{6}$/i.test(color) ? color : "#64748b",
  });
  if (error) throw new Error(error.message);
  revalidatePath("/categories");
}

export async function archiveCategory(form: FormData) {
  const { supabase } = await requireHousehold();
  const id = uuidOrNull(str(form, "id"));
  if (!id) return;
  const { error } = await supabase.from("categories").update({ archived: true }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/categories");
}

// --- Récurrences ------------------------------------------------------------

export async function addRecurrence(form: FormData) {
  const { supabase, household, user } = await requireHousehold();
  const amount = parseAmount(str(form, "amount"));
  const day = Math.min(31, Math.max(1, Number(str(form, "day_of_month")) || 1));
  if (!amount) redirect("/recurrences?erreur=montant");
  const { error } = await supabase.from("recurrences").insert({
    household_id: household.id,
    label: str(form, "label") || "—",
    kind: kindOf(str(form, "kind")),
    amount,
    currency: currencyOf(str(form, "currency")),
    day_of_month: day,
    next_on: firstOccurrence(day),
    category_id: uuidOrNull(str(form, "category_id")),
    account_id: uuidOrNull(str(form, "account_id")),
    paid_by: user.id,
    is_shared: str(form, "visibility") !== "personal",
  });
  if (error) throw new Error(error.message);
  revalidatePath("/recurrences");
}

export async function toggleRecurrence(form: FormData) {
  const { supabase } = await requireHousehold();
  const id = uuidOrNull(str(form, "id"));
  if (!id) return;
  const active = str(form, "active") === "true";
  const day = Math.min(31, Math.max(1, Number(str(form, "day_of_month")) || 1));
  // À la reprise, on repart de la prochaine échéance pour ne pas rattraper les mois en pause.
  const { error } = await supabase
    .from("recurrences")
    .update(active ? { active, next_on: firstOccurrence(day) } : { active })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/recurrences");
}

export async function deleteRecurrence(form: FormData) {
  const { supabase } = await requireHousehold();
  const id = uuidOrNull(str(form, "id"));
  if (!id) return;
  const { error } = await supabase.from("recurrences").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/recurrences");
}
