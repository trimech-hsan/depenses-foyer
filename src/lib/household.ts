import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Household, Member } from "./types";

/** Utilisateur connecté et son foyer ; redirige vers la connexion ou la création du foyer sinon. */
export async function requireHousehold() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id, households(id, name, reference_currency, split_mode)")
    .eq("user_id", user.id)
    .order("joined_at")
    .limit(1)
    .maybeSingle();

  const household = membership?.households as unknown as Household | null;
  if (!household) redirect("/bienvenue");

  const { data: members } = await supabase
    .from("household_members")
    .select("household_id, user_id, display_name, role")
    .eq("household_id", household.id)
    .order("joined_at");

  return { supabase, user, household, members: (members ?? []) as Member[] };
}
