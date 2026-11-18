export type Currency = "TND" | "EUR";
export const CURRENCIES: Currency[] = ["TND", "EUR"];
export type TxKind = "expense" | "income";
export type AccountKind = "bank" | "cash" | "card" | "savings";

export interface Household {
  id: string;
  name: string;
  reference_currency: Currency;
  split_mode: "equal" | "income";
}

export interface Member {
  household_id: string;
  user_id: string;
  display_name: string;
  role: "owner" | "member";
}

export interface Account {
  id: string;
  name: string;
  kind: AccountKind;
  currency: Currency;
  archived: boolean;
}

export interface Category {
  id: string;
  name_fr: string;
  name_ar: string | null;
  kind: TxKind;
  color: string;
  archived: boolean;
}

export interface Transaction {
  id: string;
  kind: TxKind;
  amount: number;
  currency: Currency;
  amount_reference: number | null;
  occurred_on: string;
  category_id: string | null;
  account_id: string | null;
  paid_by: string | null;
  is_shared: boolean;
  note: string | null;
  created_by: string;
}

export interface Recurrence {
  id: string;
  label: string;
  kind: TxKind;
  amount: number;
  currency: Currency;
  day_of_month: number;
  next_on: string;
  category_id: string | null;
  is_shared: boolean;
  active: boolean;
}
