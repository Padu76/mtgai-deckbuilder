-- MTG Arena AI Deck Builder — Supabase Schema (con admin_logs)
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  scryfall_id text unique not null,
  arena_id bigint,
  name text not null,
  mana_value numeric,
  mana_cost text,
  colors text[],
  color_identity text[],
  types text[],
  oracle_text text,
  set_code text,
  collector_number text,
  image_url text,
  legal_standard boolean default false,
  legal_historic boolean default false,
  legal_brawl boolean default false,
  in_arena boolean default false,
  tags text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_cards_name_trgm on public.cards using gin (name gin_trgm_ops);
create index if not exists idx_cards_arena on public.cards (in_arena);
create trigger trg_cards_updated_at before update on public.cards for each row execute function set_updated_at();

create table if not exists public.decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  format text not null check (format in ('standard','brawl')),
  bo_mode text not null check (bo_mode in ('bo1','bo3')),
  name text not null,
  commander_card_id uuid references public.cards(id),
  notes text,
  is_public boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create trigger trg_decks_updated_at before update on public.decks for each row execute function set_updated_at();

create table if not exists public.deck_cards (
  deck_id uuid not null references public.decks(id) on delete cascade,
  card_id uuid not null references public.cards(id),
  quantity int not null default 1,
  role text not null default 'main' check (role in ('main','side','commander')),
  primary key (deck_id, card_id, role)
);

create table if not exists public.external_decks (
  id uuid primary key default gen_random_uuid(),
  source text,
  source_url text,
  format text,
  created_at timestamptz default now()
);

create table if not exists public.deck_cards_cooc (
  a uuid references public.cards(id),
  b uuid references public.cards(id),
  weight numeric default 0,
  primary key (a,b)
);

create table if not exists public.combos (
  id uuid primary key default gen_random_uuid(),
  source text,
  name text,
  result_tag text,
  color_identity text[],
  links text[],
  steps text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create trigger trg_combos_updated_at before update on public.combos for each row execute function set_updated_at();

create table if not exists public.combo_cards (
  combo_id uuid references public.combos(id) on delete cascade,
  card_id uuid references public.cards(id) on delete cascade,
  primary key (combo_id, card_id)
);

create table if not exists public.admin_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  message text,
  created_at timestamptz default now()
);

alter table public.cards enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where policyname='Cards public read') then
    create policy "Cards public read" on public.cards for select using (true);
  end if;
end $$;

alter table public.combos enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where policyname='Combos public read') then
    create policy "Combos public read" on public.combos for select using (true);
  end if;
end $$;

alter table public.combo_cards enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where policyname='Combo cards public read') then
    create policy "Combo cards public read" on public.combo_cards for select using (true);
  end if;
end $$;

alter table public.decks enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where policyname='Read own or public decks') then
    create policy "Read own or public decks" on public.decks for select using ( user_id = auth.uid() or is_public = true );
  end if;
  if not exists (select 1 from pg_policies where policyname='Insert own decks') then
    create policy "Insert own decks" on public.decks for insert with check ( user_id = auth.uid() );
  end if;
  if not exists (select 1 from pg_policies where policyname='Modify own decks') then
    create policy "Modify own decks" on public.decks for update using ( user_id = auth.uid() ) with check ( user_id = auth.uid() );
  end if;
  if not exists (select 1 from pg_policies where policyname='Delete own decks') then
    create policy "Delete own decks" on public.decks for delete using ( user_id = auth.uid() );
  end if;
end $$;

alter table public.deck_cards enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where policyname='Read cards of own or public decks') then
    create policy "Read cards of own or public decks" on public.deck_cards for select using (
      exists (select 1 from public.decks d where d.id = deck_id and (d.user_id = auth.uid() or d.is_public = true))
    );
  end if;
  if not exists (select 1 from pg_policies where policyname='Modify cards of own decks') then
    create policy "Modify cards of own decks" on public.deck_cards for all using (
      exists (select 1 from public.decks d where d.id = deck_id and d.user_id = auth.uid())
    ) with check (
      exists (select 1 from public.decks d where d.id = deck_id and d.user_id = auth.uid())
    );
  end if;
end $$;

alter table public.external_decks enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where policyname='External decks public read') then
    create policy "External decks public read" on public.external_decks for select using (true);
  end if;
end $$;

alter table public.deck_cards_cooc enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where policyname='Cooc public read') then
    create policy "Cooc public read" on public.deck_cards_cooc for select using (true);
  end if;
end $$;

alter table public.admin_logs enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where policyname='Admin logs public read') then
    create policy "Admin logs public read" on public.admin_logs for select using (true);
  end if;
end $$;
