// Exécute la migration dans un PostgreSQL embarqué (PGlite) avec un faux schéma
// `auth` imitant Supabase, puis vérifie les procédures et les règles d'accès.
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const ALICE = "00000000-0000-0000-0000-00000000000a";
const BOB = "00000000-0000-0000-0000-00000000000b";
const EVE = "00000000-0000-0000-0000-00000000000e";

const AUTH_STUB = `
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role authenticated;
  grant usage on schema auth to authenticated;
  insert into auth.users values ('${ALICE}'), ('${BOB}'), ('${EVE}');
`;

const GRANTS = `
  grant usage on schema public to authenticated;
  grant select, insert, update, delete on all tables in schema public to authenticated;
`;

let db: PGlite;

async function as<T>(user: string, sql: string, params: unknown[] = []): Promise<T[]> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${user}', false);`);
  try {
    const res = await db.query<T>(sql, params);
    return res.rows;
  } finally {
    await db.exec(`reset role;`);
  }
}

describe("schéma Supabase", () => {
  let hid: string;

  beforeAll(async () => {
    db = new PGlite({ extensions: { pgcrypto } });
    await db.exec(AUTH_STUB);
    await db.exec(readFileSync(join(__dirname, "../migrations/0001_init.sql"), "utf8"));
    await db.exec(GRANTS);
    const [row] = await as<{ id: string }>(ALICE, `select public.create_household('Maison', 'Alice', 'TND') as id`);
    hid = row.id;
  });

  it("crée le foyer avec comptes et catégories par défaut", async () => {
    const cats = await as<{ n: number }>(ALICE, `select count(*)::int as n from categories where household_id = $1`, [hid]);
    const accounts = await as<{ n: number }>(ALICE, `select count(*)::int as n from accounts where household_id = $1`, [hid]);
    expect(cats[0].n).toBe(11);
    expect(accounts[0].n).toBe(2);
  });

  it("isole les foyers : un non-membre ne voit rien", async () => {
    const rows = await as(EVE, `select * from households`);
    expect(rows).toHaveLength(0);
    await expect(as(EVE, `select public.create_invitation($1)`, [hid])).rejects.toThrow(/not_member/);
  });

  it("permet d'inviter le conjoint une seule fois", async () => {
    const [{ code }] = await as<{ code: string }>(ALICE, `select public.create_invitation($1) as code`, [hid]);
    await as(BOB, `select public.accept_invitation($1, 'Bob')`, [code]);
    const members = await as<{ n: number }>(BOB, `select count(*)::int as n from household_members where household_id = $1`, [hid]);
    expect(members[0].n).toBe(2);
    await expect(as(EVE, `select public.accept_invitation($1, 'Eve')`, [code])).rejects.toThrow(/invalid_invitation/);
  });

  it("cache les dépenses personnelles au conjoint", async () => {
    await as(ALICE, `insert into transactions (household_id, amount, currency, is_shared, note) values ($1, 10, 'TND', true, 'commune')`, [hid]);
    await as(ALICE, `insert into transactions (household_id, amount, currency, is_shared, note) values ($1, 5, 'TND', false, 'perso')`, [hid]);
    const seenByBob = await as<{ note: string }>(BOB, `select note from transactions where household_id = $1 order by note`, [hid]);
    expect(seenByBob.map((r) => r.note)).toEqual(["commune"]);
    const seenByAlice = await as(ALICE, `select note from transactions where household_id = $1`, [hid]);
    expect(seenByAlice).toHaveLength(2);
  });

  it("refuse d'écrire dans le foyer d'un autre", async () => {
    await expect(
      as(EVE, `insert into transactions (household_id, amount, currency) values ($1, 1, 'TND')`, [hid]),
    ).rejects.toThrow();
  });

  it("convertit les montants en devise de référence", async () => {
    await as(ALICE, `insert into exchange_rates (household_id, currency, valid_from, rate) values ($1, 'EUR', '2026-01-01', 3.4)`, [hid]);
    const [row] = await as<{ amount_reference: string }>(
      ALICE,
      `insert into transactions (household_id, amount, currency, occurred_on) values ($1, 20, 'EUR', '2026-11-10') returning amount_reference`,
      [hid],
    );
    expect(Number(row.amount_reference)).toBe(68);
  });

  it("recalcule les montants quand un taux est ajouté après coup", async () => {
    await as(BOB, `insert into transactions (household_id, amount, currency, occurred_on, is_shared, note) values ($1, 10, 'EUR', '2026-12-02', false, 'bob-perso')`, [hid]);
    await as(ALICE, `insert into exchange_rates (household_id, currency, valid_from, rate) values ($1, 'EUR', '2026-12-01', 3.5)`, [hid]);
    const [row] = await as<{ amount_reference: string }>(BOB, `select amount_reference from transactions where note = 'bob-perso'`);
    expect(Number(row.amount_reference)).toBe(35);
  });

  it("calcule la prochaine échéance en respectant les fins de mois", async () => {
    const rows = await as<{ a: string; b: string; c: string }>(
      ALICE,
      `select public.next_occurrence('2026-01-31', 31)::text as a,
              public.next_occurrence('2026-02-28', 31)::text as b,
              public.next_occurrence('2026-12-05', 5)::text as c`,
    );
    expect(rows[0]).toEqual({ a: "2026-02-28", b: "2026-03-31", c: "2027-01-05" });
  });

  it("génère les récurrences échues et rattrape les mois manqués", async () => {
    await as(
      ALICE,
      `insert into recurrences (household_id, amount, currency, label, day_of_month, next_on)
       values ($1, 500, 'TND', 'Loyer', 1, (date_trunc('month', current_date) - interval '2 month')::date)`,
      [hid],
    );
    const [{ n }] = await as<{ n: number }>(ALICE, `select public.generate_due_recurrences($1) as n`, [hid]);
    expect(n).toBe(3);
    const [{ again }] = await as<{ again: number }>(ALICE, `select public.generate_due_recurrences($1) as again`, [hid]);
    expect(again).toBe(0);
  });
});
