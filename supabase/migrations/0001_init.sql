-- Schéma initial : foyer partagé, comptes, catégories, transactions, récurrences.
-- Toutes les données sont rattachées à un foyer ; les règles RLS limitent
-- chaque utilisateur aux foyers dont il est membre.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  reference_currency text not null default 'TND' check (reference_currency in ('TND', 'EUR')),
  split_mode text not null default 'equal' check (split_mode in ('equal', 'income')),
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  role text not null default 'member' check (role in ('owner', 'member')),
  monthly_income numeric(14, 3),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table public.invitations (
  code text primary key default encode(gen_random_bytes(12), 'hex'),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users (id),
  expires_at timestamptz not null default now() + interval '7 days',
  used_by uuid references auth.users (id),
  used_at timestamptz
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  kind text not null default 'bank' check (kind in ('bank', 'cash', 'card', 'savings')),
  currency text not null check (currency in ('TND', 'EUR')),
  owner_id uuid references auth.users (id),
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  parent_id uuid references public.categories (id) on delete set null,
  name_fr text not null check (char_length(name_fr) between 1 and 60),
  name_ar text,
  kind text not null default 'expense' check (kind in ('expense', 'income')),
  color text not null default '#64748b' check (color ~ '^#[0-9a-fA-F]{6}$'),
  icon text,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

-- Taux de conversion vers la devise de référence du foyer, valables à partir d'une date.
create table public.exchange_rates (
  household_id uuid not null references public.households (id) on delete cascade,
  currency text not null check (currency in ('TND', 'EUR')),
  valid_from date not null,
  rate numeric(14, 6) not null check (rate > 0),
  primary key (household_id, currency, valid_from)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  account_id uuid references public.accounts (id) on delete set null,
  category_id uuid references public.categories (id) on delete set null,
  kind text not null default 'expense' check (kind in ('expense', 'income')),
  amount numeric(14, 3) not null check (amount > 0),
  currency text not null check (currency in ('TND', 'EUR')),
  amount_reference numeric(14, 3),
  occurred_on date not null default current_date,
  paid_by uuid references auth.users (id),
  is_shared boolean not null default true,
  note text check (char_length(note) <= 500),
  receipt_path text,
  recurrence_id uuid,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);

create index transactions_household_date_idx on public.transactions (household_id, occurred_on desc);

create table public.recurrences (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  account_id uuid references public.accounts (id) on delete set null,
  category_id uuid references public.categories (id) on delete set null,
  kind text not null default 'expense' check (kind in ('expense', 'income')),
  amount numeric(14, 3) not null check (amount > 0),
  currency text not null check (currency in ('TND', 'EUR')),
  label text not null check (char_length(label) between 1 and 80),
  day_of_month int not null check (day_of_month between 1 and 31),
  next_on date not null,
  paid_by uuid references auth.users (id),
  is_shared boolean not null default true,
  active boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);

alter table public.transactions
  add constraint transactions_recurrence_fk
  foreign key (recurrence_id) references public.recurrences (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Fonctions utilitaires
-- ---------------------------------------------------------------------------

create or replace function public.is_member(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hid and m.user_id = auth.uid()
  );
$$;

-- Taux applicable à une date : 1 pour la devise de référence, sinon le dernier taux connu.
create or replace function public.rate_for(hid uuid, cur text, on_date date)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select case
    when cur = (select reference_currency from public.households where id = hid) then 1::numeric
    else (
      select r.rate from public.exchange_rates r
      where r.household_id = hid and r.currency = cur and r.valid_from <= on_date
      order by r.valid_from desc
      limit 1
    )
  end;
$$;

create or replace function public.set_amount_reference()
returns trigger
language plpgsql
as $$
begin
  new.amount_reference := round(new.amount * public.rate_for(new.household_id, new.currency, new.occurred_on), 3);
  return new;
end;
$$;

create trigger transactions_amount_reference
before insert or update of amount, currency, occurred_on on public.transactions
for each row execute function public.set_amount_reference();

-- Un nouveau taux recalcule les montants convertis des opérations concernées.
create or replace function public.refresh_amount_reference()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update transactions t
  set amount_reference = round(t.amount * public.rate_for(t.household_id, t.currency, t.occurred_on), 3)
  where t.household_id = new.household_id
    and t.currency = new.currency
    and t.occurred_on >= new.valid_from;
  return null;
end;
$$;

create trigger exchange_rates_refresh
after insert or update on public.exchange_rates
for each row execute function public.refresh_amount_reference();

-- Même jour du mois suivant, ramené au dernier jour si le mois est plus court.
create or replace function public.next_occurrence(from_date date, dom int)
returns date
language sql
immutable
as $$
  select (date_trunc('month', from_date) + interval '1 month')::date
         + (least(dom, extract(day from (date_trunc('month', from_date) + interval '2 month - 1 day'))::int) - 1);
$$;

-- ---------------------------------------------------------------------------
-- Procédures appelées par l'application
-- ---------------------------------------------------------------------------

-- Crée un foyer, en fait l'utilisateur propriétaire et ajoute catégories et comptes par défaut.
create or replace function public.create_household(p_name text, p_display_name text, p_reference_currency text default 'TND')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  insert into households (name, reference_currency, created_by)
  values (p_name, p_reference_currency, uid)
  returning id into hid;

  insert into household_members (household_id, user_id, display_name, role)
  values (hid, uid, p_display_name, 'owner');

  insert into accounts (household_id, name, kind, currency, owner_id) values
    (hid, 'Compte joint', 'bank', p_reference_currency, null),
    (hid, 'Espèces', 'cash', p_reference_currency, null);

  insert into categories (household_id, name_fr, name_ar, kind, color, icon) values
    (hid, 'Courses', 'المشتريات', 'expense', '#16a34a', 'cart'),
    (hid, 'Logement', 'السكن', 'expense', '#2563eb', 'home'),
    (hid, 'Factures', 'الفواتير', 'expense', '#0891b2', 'bolt'),
    (hid, 'Transport', 'النقل', 'expense', '#ea580c', 'car'),
    (hid, 'Santé', 'الصحة', 'expense', '#dc2626', 'heart'),
    (hid, 'Enfants', 'الأطفال', 'expense', '#db2777', 'child'),
    (hid, 'Loisirs', 'الترفيه', 'expense', '#7c3aed', 'star'),
    (hid, 'Restaurants', 'المطاعم', 'expense', '#ca8a04', 'utensils'),
    (hid, 'Divers', 'متفرقات', 'expense', '#64748b', 'dots'),
    (hid, 'Salaire', 'الراتب', 'income', '#059669', 'wallet'),
    (hid, 'Autres revenus', 'مداخيل أخرى', 'income', '#0d9488', 'plus');

  return hid;
end;
$$;

create or replace function public.create_invitation(p_household_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  c text;
begin
  if not public.is_member(p_household_id) then
    raise exception 'not_member';
  end if;
  insert into invitations (household_id, created_by)
  values (p_household_id, auth.uid())
  returning code into c;
  return c;
end;
$$;

create or replace function public.accept_invitation(p_code text, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv invitations%rowtype;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into inv from invitations where code = p_code for update;
  if not found or inv.used_at is not null or inv.expires_at < now() then
    raise exception 'invalid_invitation';
  end if;

  insert into household_members (household_id, user_id, display_name, role)
  values (inv.household_id, uid, p_display_name, 'member')
  on conflict (household_id, user_id) do nothing;

  update invitations set used_by = uid, used_at = now() where code = p_code;
  return inv.household_id;
end;
$$;

-- Crée les transactions des récurrences arrivées à échéance (rattrape les mois manqués).
create or replace function public.generate_due_recurrences(p_household_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r recurrences%rowtype;
  created int := 0;
begin
  if not public.is_member(p_household_id) then
    raise exception 'not_member';
  end if;

  for r in
    select * from recurrences
    where household_id = p_household_id and active and next_on <= current_date
    for update
  loop
    while r.next_on <= current_date loop
      insert into transactions (household_id, account_id, category_id, kind, amount, currency,
                                occurred_on, paid_by, is_shared, note, recurrence_id, created_by)
      values (r.household_id, r.account_id, r.category_id, r.kind, r.amount, r.currency,
              r.next_on, r.paid_by, r.is_shared, r.label, r.id, r.created_by);
      created := created + 1;
      r.next_on := public.next_occurrence(r.next_on, r.day_of_month);
    end loop;
    update recurrences set next_on = r.next_on where id = r.id;
  end loop;

  return created;
end;
$$;

-- ---------------------------------------------------------------------------
-- Règles d'accès (RLS)
-- ---------------------------------------------------------------------------

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.invitations enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.exchange_rates enable row level security;
alter table public.transactions enable row level security;
alter table public.recurrences enable row level security;

create policy households_select on public.households for select using (public.is_member(id));
create policy households_update on public.households for update using (public.is_member(id));

create policy members_select on public.household_members for select using (public.is_member(household_id));
create policy members_update_self on public.household_members for update using (user_id = auth.uid());

create policy invitations_select on public.invitations for select using (public.is_member(household_id));

create policy accounts_all on public.accounts for all
  using (public.is_member(household_id)) with check (public.is_member(household_id));

create policy categories_all on public.categories for all
  using (public.is_member(household_id)) with check (public.is_member(household_id));

create policy rates_all on public.exchange_rates for all
  using (public.is_member(household_id)) with check (public.is_member(household_id));

-- Une dépense personnelle (is_shared = false) n'est visible que par son auteur.
create policy transactions_select on public.transactions for select
  using (public.is_member(household_id) and (is_shared or created_by = auth.uid()));
create policy transactions_insert on public.transactions for insert
  with check (public.is_member(household_id) and created_by = auth.uid());
create policy transactions_update on public.transactions for update
  using (public.is_member(household_id) and (is_shared or created_by = auth.uid()))
  with check (public.is_member(household_id) and (is_shared or created_by = auth.uid()));
create policy transactions_delete on public.transactions for delete
  using (public.is_member(household_id) and (is_shared or created_by = auth.uid()));

create policy recurrences_select on public.recurrences for select
  using (public.is_member(household_id) and (is_shared or created_by = auth.uid()));
create policy recurrences_insert on public.recurrences for insert
  with check (public.is_member(household_id) and created_by = auth.uid());
create policy recurrences_update on public.recurrences for update
  using (public.is_member(household_id) and (is_shared or created_by = auth.uid()))
  with check (public.is_member(household_id) and (is_shared or created_by = auth.uid()));
create policy recurrences_delete on public.recurrences for delete
  using (public.is_member(household_id) and (is_shared or created_by = auth.uid()));

grant execute on function public.create_household(text, text, text) to authenticated;
grant execute on function public.create_invitation(uuid) to authenticated;
grant execute on function public.accept_invitation(text, text) to authenticated;
grant execute on function public.generate_due_recurrences(uuid) to authenticated;
