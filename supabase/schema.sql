-- =====================================================================
-- SUBASTA A TASTE OF HOPE · UNICEF REPÚBLICA DOMINICANA
-- Estructura de la base de datos (versión 2)
--
-- Cómo usarlo: Supabase > SQL Editor > New query > pegar todo > Run.
-- Se puede ejecutar varias veces. Actualiza la versión anterior sin
-- borrar participantes ni pujas reales.
-- =====================================================================

create extension if not exists pgcrypto;

-- La vista anterior depende de columnas que se eliminan más abajo.
drop view if exists public.auction_items_public;


-- ---------------------------------------------------------------------
-- 1. CONFIGURACIÓN GENERAL (una sola fila)
--    is_open:    el equipo abre y cierra la subasta desde /admin.
--    currency:   'DOP' (RD$) o 'USD' (US$).
-- ---------------------------------------------------------------------
create table if not exists public.auction_settings (
  id          int primary key default 1 check (id = 1),
  is_open     boolean   not null default false,
  currency    text      not null default 'DOP' check (currency in ('DOP','USD')),
  updated_at  timestamptz not null default now()
);
insert into public.auction_settings (id) values (1) on conflict (id) do nothing;
-- Ya no hay montos predeterminados: cada persona escribe cuánto sube.
alter table public.auction_settings drop column if exists increments;


-- ---------------------------------------------------------------------
-- 2. LOTES
-- ---------------------------------------------------------------------
create table if not exists public.auction_items (
  id              uuid primary key default gen_random_uuid(),
  lot_number      integer not null unique,
  title           text not null,
  description     text,
  category        text,
  image_url       text,
  starting_price  numeric(12,2) not null check (starting_price >= 0),
  current_bid     numeric(12,2) not null default 0 check (current_bid >= 0),
  leader_name     text,
  bid_count       integer not null default 0,
  status          text not null default 'open' check (status in ('draft','open','paused','closed')),
  featured        boolean not null default false,
  winner_bid_id   uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Ajustes sobre la tabla de la versión anterior
alter table public.auction_items add column if not exists leader_name text;
alter table public.auction_items add column if not exists bid_count integer not null default 0;
alter table public.auction_items alter column current_bid set default 0;
alter table public.auction_items alter column status set default 'open';
-- El cierre ahora es manual: ya no se usan fechas ni incremento por lote.
alter table public.auction_items drop column if exists minimum_increment;
alter table public.auction_items drop column if exists starts_at;
alter table public.auction_items drop column if exists closes_at;

-- Para que el tiempo real siempre envíe la fila completa.
alter table public.auction_items replica identity full;

-- El precio actual arranca en el precio inicial y lo sigue mientras
-- el lote no tenga pujas (así puedes ajustar precios antes del evento).
create or replace function public.sync_starting_price()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.current_bid   := new.starting_price;
    new.leader_name   := null;
    new.bid_count     := 0;
    new.winner_bid_id := null;
  elsif new.starting_price is distinct from old.starting_price and old.bid_count = 0 then
    new.current_bid := new.starting_price;
  end if;
  return new;
end $$;

drop trigger if exists trg_sync_starting_price on public.auction_items;
create trigger trg_sync_starting_price
  before insert or update on public.auction_items
  for each row execute function public.sync_starting_price();


-- ---------------------------------------------------------------------
-- 3. PARTICIPANTES (PRIVADA: correo y teléfono nunca llegan al sitio)
-- ---------------------------------------------------------------------
create table if not exists public.participants (
  id                uuid primary key default gen_random_uuid(),
  first_name        text not null,
  last_name         text not null,
  email             text not null,
  email_normalized  text generated always as (lower(trim(email))) stored,
  phone             text,
  terms_accepted_at timestamptz not null,
  created_at        timestamptz not null default now()
);
alter table public.participants add column if not exists phone text;
create unique index if not exists participants_email_unique on public.participants (email_normalized);


-- ---------------------------------------------------------------------
-- 4. PUJAS (PRIVADA: historial completo)
-- ---------------------------------------------------------------------
create table if not exists public.bids (
  id             uuid primary key default gen_random_uuid(),
  item_id        uuid not null references public.auction_items(id),
  participant_id uuid not null references public.participants(id),
  amount         numeric(12,2) not null check (amount > 0),
  status         text not null default 'accepted' check (status in ('accepted','outbid','winning','cancelled')),
  created_at     timestamptz not null default now()
);
create index if not exists bids_item_created_index on public.bids (item_id, created_at desc);

alter table public.auction_items drop constraint if exists auction_items_winner_bid_fk;
alter table public.auction_items add constraint auction_items_winner_bid_fk
  foreign key (winner_bid_id) references public.bids(id);

-- Completa líder y conteo para pujas que ya existieran.
update public.auction_items a set
  bid_count   = (select count(*) from public.bids b where b.item_id = a.id),
  leader_name = (select p.first_name || ' ' || p.last_name
                   from public.bids b join public.participants p on p.id = b.participant_id
                  where b.id = a.winner_bid_id);


-- ---------------------------------------------------------------------
-- 5. SEGURIDAD (Row Level Security)
--    El sitio solo puede LEER lotes visibles y la configuración.
--    Participantes y pujas no tienen políticas: nadie las ve desde el sitio.
--    Las pujas solo entran por la API del servidor (/api/bids).
-- ---------------------------------------------------------------------
alter table public.auction_settings enable row level security;
alter table public.auction_items    enable row level security;
alter table public.participants     enable row level security;
alter table public.bids             enable row level security;

drop policy if exists "Public can view open items" on public.auction_items;
drop policy if exists "Public can view items" on public.auction_items;
create policy "Public can view items"
  on public.auction_items for select to anon, authenticated
  using (status <> 'draft');

drop policy if exists "Public can view settings" on public.auction_settings;
create policy "Public can view settings"
  on public.auction_settings for select to anon, authenticated
  using (true);


-- ---------------------------------------------------------------------
-- 6. FUNCIÓN DE PUJA
--    La persona escribe cuánto quiere subir (p_increment) y se suma al
--    precio actual. Bloquea el lote mientras suma: dos pujas simultáneas
--    nunca se pisan.
--    p_expected_bid es el precio que la persona veía al confirmar; si
--    alguien pujó antes, se rechaza con PRICE_CHANGED.
-- ---------------------------------------------------------------------
drop function if exists public.place_bid(uuid, text, text, text, numeric);

create or replace function public.place_bid(
  p_item_id      uuid,
  p_first_name   text,
  p_last_name    text,
  p_email        text,
  p_phone        text,
  p_increment    numeric,
  p_expected_bid numeric
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_settings       auction_settings%rowtype;
  v_item           auction_items%rowtype;
  v_participant_id uuid;
  v_bid_id         uuid;
  v_new_bid        numeric;
  v_leader         text;
begin
  select * into v_settings from auction_settings where id = 1;
  if not found or not v_settings.is_open then raise exception 'AUCTION_CLOSED'; end if;
  if p_increment is null or p_increment <= 0 or p_increment <> trunc(p_increment) then
    raise exception 'INVALID_AMOUNT';
  end if;

  select * into v_item from auction_items where id = p_item_id for update;
  if not found then raise exception 'ITEM_NOT_FOUND'; end if;
  if v_item.status <> 'open' then raise exception 'ITEM_NOT_OPEN'; end if;
  if v_item.current_bid <> p_expected_bid then raise exception 'PRICE_CHANGED'; end if;

  v_new_bid := v_item.current_bid + p_increment;
  if v_new_bid >= 10000000000 then raise exception 'AMOUNT_TOO_HIGH'; end if;
  v_leader  := trim(p_first_name) || ' ' || trim(p_last_name);

  insert into participants (first_name, last_name, email, phone, terms_accepted_at)
  values (trim(p_first_name), trim(p_last_name), lower(trim(p_email)), trim(p_phone), now())
  on conflict (email_normalized) do update
    set first_name = excluded.first_name,
        last_name  = excluded.last_name,
        phone      = excluded.phone
  returning id into v_participant_id;

  update bids set status = 'outbid' where item_id = p_item_id and status = 'winning';

  insert into bids (item_id, participant_id, amount, status)
  values (p_item_id, v_participant_id, v_new_bid, 'winning')
  returning id into v_bid_id;

  update auction_items
     set current_bid   = v_new_bid,
         leader_name   = v_leader,
         bid_count     = v_item.bid_count + 1,
         winner_bid_id = v_bid_id,
         updated_at    = now()
   where id = p_item_id;

  return jsonb_build_object(
    'amount',      v_new_bid,
    'leader_name', v_leader,
    'bid_count',   v_item.bid_count + 1,
    'lot_number',  v_item.lot_number,
    'title',       v_item.title,
    'currency',    v_settings.currency
  );
end $$;

revoke all on function public.place_bid(uuid, text, text, text, text, numeric, numeric) from public, anon, authenticated;
grant execute on function public.place_bid(uuid, text, text, text, text, numeric, numeric) to service_role;


-- ---------------------------------------------------------------------
-- 7. TIEMPO REAL
-- ---------------------------------------------------------------------
do $$
begin
  begin
    alter publication supabase_realtime add table public.auction_items;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.auction_settings;
  exception when duplicate_object then null;
  end;
end $$;


-- ---------------------------------------------------------------------
-- 8. GANADORES (solo para el panel /admin, nunca para el público)
-- ---------------------------------------------------------------------
drop view if exists public.auction_winners;
create view public.auction_winners with (security_invoker = true) as
select a.lot_number,
       a.title,
       a.status,
       b.amount,
       p.first_name,
       p.last_name,
       p.email,
       p.phone,
       b.created_at as bid_at
  from public.auction_items a
  join public.bids b         on b.id = a.winner_bid_id
  join public.participants p on p.id = b.participant_id;

revoke all on public.auction_winners from anon, authenticated;
grant select on public.auction_winners to service_role;


-- ---------------------------------------------------------------------
-- 9. LIMPIEZA: elimina los dos lotes de ejemplo de la versión anterior
-- ---------------------------------------------------------------------
update public.auction_items set winner_bid_id = null
 where title in ('Cena privada para seis personas', 'Escapada de lujo para dos')
   and image_url like 'https://images.unsplash.com/%';
delete from public.bids where item_id in (
  select id from public.auction_items
   where title in ('Cena privada para seis personas', 'Escapada de lujo para dos')
     and image_url like 'https://images.unsplash.com/%');
delete from public.auction_items
 where title in ('Cena privada para seis personas', 'Escapada de lujo para dos')
   and image_url like 'https://images.unsplash.com/%';


-- =====================================================================
-- COMANDOS ÚTILES (copiar solo la línea necesaria y ejecutarla)
-- =====================================================================
-- Abrir o cerrar la subasta (también se puede desde /admin):
--   update auction_settings set is_open = true  where id = 1;
--   update auction_settings set is_open = false where id = 1;
--
-- Cambiar la moneda:
--   update auction_settings set currency = 'USD' where id = 1;
--
-- BORRAR TODAS LAS PUJAS DE PRUEBA antes del evento (ejecutar las 3 juntas):
--   update auction_items set winner_bid_id = null, current_bid = starting_price,
--          leader_name = null, bid_count = 0, status = 'open';
--   delete from bids;
--   delete from participants;
