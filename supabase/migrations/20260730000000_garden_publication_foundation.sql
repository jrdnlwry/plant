-- Transactional garden publication. A transaction-scoped advisory lock per biome
-- serializes numbering, capacity checks, and deterministic plot claims.
alter table public.account_profiles drop constraint account_profiles_state_code;
alter table public.public_contributors drop constraint public_contributors_state_code;
alter table public.account_profiles add constraint account_profiles_state_code check (state_code is null or state_code in
  ('AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'));
alter table public.public_contributors add constraint public_contributors_state_code check (state_code is null or state_code in
  ('AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'));

create type public.garden_biome as enum ('south','north','west','central');
create type public.garden_status as enum ('open','near-capacity','closed-to-new-plants','full','archived');
create type public.garden_plot_type as enum ('plantable','path','environment');

create table public.gardens (
  id text primary key default ('garden_' || encode(extensions.gen_random_bytes(18), 'hex')),
  biome public.garden_biome not null,
  garden_number integer not null check (garden_number > 0),
  status public.garden_status not null default 'open',
  columns integer not null default 12 check (columns = 12),
  rows integer not null default 8 check (rows = 8),
  total_plantable_plots integer not null default 72,
  new_submission_capacity integer not null default 61 check (new_submission_capacity <= total_plantable_plots),
  created_at timestamptz not null default now(), closed_at timestamptz,
  unique (biome, garden_number)
);

create table public.garden_plots (
  id text primary key default ('plot_' || encode(extensions.gen_random_bytes(18), 'hex')),
  garden_id text not null references public.gardens(id) on delete restrict,
  row_number integer not null check (row_number between 0 and 7),
  column_number integer not null check (column_number between 0 and 11),
  plot_type public.garden_plot_type not null,
  reserved_until timestamptz,
  created_at timestamptz not null default now(),
  unique (garden_id, row_number, column_number)
);

create table public.garden_plants (
  id text primary key default ('gplant_' || encode(extensions.gen_random_bytes(18), 'hex')),
  source_local_plant_id text not null, completed_plant_id text not null unique,
  publication_intent_id text not null unique,
  owner_public_id text not null references public.public_contributors(public_id) on delete restrict,
  plant_type text not null check (plant_type in ('fern','succulent','blossom','vine','sapling')),
  visual_seed text not null, canonical_snapshot jsonb not null, renderer_snapshot_version integer not null,
  snapshot_digest text not null check (snapshot_digest ~ '^[0-9a-f]{64}$'),
  biome public.garden_biome not null, garden_id text not null references public.gardens(id) on delete restrict,
  plot_id text not null unique references public.garden_plots(id) on delete restrict,
  row_number integer not null check (row_number between 0 and 7), column_number integer not null check (column_number between 0 and 11),
  root_plant_id text references public.garden_plants(id) deferrable initially deferred,
  generation integer not null default 1 check (generation = 1), status text not null default 'active' check (status = 'active'),
  source_created_at timestamptz not null, matured_at timestamptz not null,
  added_to_garden_at timestamptz not null default now(), last_simulated_date date not null default current_date,
  archived_historical_record boolean not null default false check (not archived_historical_record),
  created_at timestamptz not null default now(),
  foreign key (garden_id, row_number, column_number) references public.garden_plots(garden_id, row_number, column_number)
);

create table public.plant_publication_receipts (
  id text primary key default ('receipt_' || encode(extensions.gen_random_bytes(18), 'hex')),
  account_id uuid not null references auth.users(id) on delete restrict,
  publication_intent_id text not null unique, completed_plant_id text not null unique, source_local_plant_id text not null,
  garden_plant_id text not null unique references public.garden_plants(id) on delete restrict,
  garden_id text not null references public.gardens(id) on delete restrict, biome public.garden_biome not null,
  garden_number integer not null, plot_id text not null references public.garden_plots(id) on delete restrict,
  row_number integer not null, column_number integer not null, public_garden_path text not null,
  snapshot_digest text not null check (snapshot_digest ~ '^[0-9a-f]{64}$'), created_at timestamptz not null default now()
);

alter table public.gardens enable row level security;
alter table public.garden_plots enable row level security;
alter table public.garden_plants enable row level security;
alter table public.plant_publication_receipts enable row level security;
revoke all on public.gardens, public.garden_plots, public.garden_plants, public.plant_publication_receipts from anon, authenticated;
create policy publication_receipts_select_own on public.plant_publication_receipts for select to authenticated using ((select auth.uid()) = account_id);
grant select on public.plant_publication_receipts to authenticated;

create function public.garden_layout_cells(p_biome public.garden_biome)
returns table(row_number integer, column_number integer, plot_type public.garden_plot_type)
language sql immutable set search_path = '' as $$
  -- Each CASE branch is separately addressable even though phase-one geometry matches.
  select r, c, case p_biome
    when 'south' then case when c % 4 = 3 then 'path' else 'plantable' end
    when 'north' then case when c % 4 = 3 then 'path' else 'plantable' end
    when 'west' then case when c % 4 = 3 then 'path' else 'plantable' end
    when 'central' then case when c % 4 = 3 then 'path' else 'plantable' end
  end::public.garden_plot_type from generate_series(0,7) r cross join generate_series(0,11) c
$$;
revoke all on function public.garden_layout_cells(public.garden_biome) from public;

create function public.publish_completed_plant(
  p_account_id uuid, p_owner_public_id text, p_biome public.garden_biome,
  p_publication_intent_id text, p_completed_plant_id text, p_source_local_plant_id text,
  p_plant_type text, p_visual_seed text, p_snapshot jsonb, p_snapshot_version integer,
  p_snapshot_digest text, p_created_at timestamptz, p_matured_at timestamptz
) returns jsonb security definer language plpgsql set search_path = '' as $$
declare r public.plant_publication_receipts; g public.gardens; p public.garden_plots; gp public.garden_plants; occupied integer; replay boolean := false;
begin
  select * into r from public.plant_publication_receipts where publication_intent_id = p_publication_intent_id;
  if found then
    if r.account_id <> p_account_id or r.completed_plant_id <> p_completed_plant_id or r.source_local_plant_id <> p_source_local_plant_id or r.snapshot_digest <> p_snapshot_digest then return jsonb_build_object('error','idempotency-conflict'); end if;
    replay := true;
  else
    perform pg_advisory_xact_lock(hashtextextended('garden-publication:' || p_biome::text, 0));
    select * into r from public.plant_publication_receipts where publication_intent_id = p_publication_intent_id for update;
    if found then
      if r.account_id <> p_account_id or r.completed_plant_id <> p_completed_plant_id or r.source_local_plant_id <> p_source_local_plant_id or r.snapshot_digest <> p_snapshot_digest then return jsonb_build_object('error','idempotency-conflict'); end if;
      replay := true;
    else
      select * into g from public.gardens where biome = p_biome and status in ('open','near-capacity') order by garden_number desc limit 1 for update;
      if found then
        select count(*) into occupied from public.garden_plants where garden_id = g.id;
        if occupied >= g.new_submission_capacity then update public.gardens set status='closed-to-new-plants', closed_at=now() where id=g.id; g := null; end if;
      end if;
      if g.id is null then
        insert into public.gardens(biome,garden_number) select p_biome, coalesce(max(garden_number),0)+1 from public.gardens where biome=p_biome returning * into g;
        insert into public.garden_plots(garden_id,row_number,column_number,plot_type) select g.id,l.row_number,l.column_number,l.plot_type from public.garden_layout_cells(p_biome) l on conflict do nothing;
      end if;
      select * into p from public.garden_plots where garden_id=g.id and plot_type='plantable' and (reserved_until is null or reserved_until <= now()) and not exists (select 1 from public.garden_plants x where x.plot_id=garden_plots.id) order by row_number,column_number limit 1 for update skip locked;
      if not found then raise exception using errcode='P0001', message='plot-assignment-failed'; end if;
      insert into public.garden_plants(source_local_plant_id,completed_plant_id,publication_intent_id,owner_public_id,plant_type,visual_seed,canonical_snapshot,renderer_snapshot_version,snapshot_digest,biome,garden_id,plot_id,row_number,column_number,source_created_at,matured_at)
        values(p_source_local_plant_id,p_completed_plant_id,p_publication_intent_id,p_owner_public_id,p_plant_type,p_visual_seed,p_snapshot,p_snapshot_version,p_snapshot_digest,p_biome,g.id,p.id,p.row_number,p.column_number,p_created_at,p_matured_at) returning * into gp;
      update public.garden_plants set root_plant_id=id where id=gp.id;
      insert into public.plant_publication_receipts(account_id,publication_intent_id,completed_plant_id,source_local_plant_id,garden_plant_id,garden_id,biome,garden_number,plot_id,row_number,column_number,public_garden_path,snapshot_digest)
        values(p_account_id,p_publication_intent_id,p_completed_plant_id,p_source_local_plant_id,gp.id,g.id,p_biome,g.garden_number,p.id,p.row_number,p.column_number,'/garden/'||p_biome::text||'/'||g.garden_number||'?plant='||gp.id,p_snapshot_digest) returning * into r;
      select count(*) into occupied from public.garden_plants where garden_id=g.id;
      update public.gardens set status=case when occupied >= new_submission_capacity then 'closed-to-new-plants'::public.garden_status when occupied >= 55 then 'near-capacity'::public.garden_status else status end, closed_at=case when occupied >= new_submission_capacity then now() else closed_at end where id=g.id;
    end if;
  end if;
  return jsonb_build_object('receiptId',r.id,'publicationIntentId',r.publication_intent_id,'completedPlantId',r.completed_plant_id,'gardenPlantId',r.garden_plant_id,'biome',r.biome,'gardenNumber',r.garden_number,'plotId',r.plot_id,'row',r.row_number,'column',r.column_number,'publicGardenPath',r.public_garden_path,'createdAt',r.created_at,'idempotentReplay',replay);
exception when unique_violation then return jsonb_build_object('error','idempotency-conflict');
end $$;
revoke all on function public.publish_completed_plant(uuid,text,public.garden_biome,text,text,text,text,text,jsonb,integer,text,timestamptz,timestamptz) from public;
grant execute on function public.publish_completed_plant(uuid,text,public.garden_biome,text,text,text,text,text,jsonb,integer,text,timestamptz,timestamptz) to service_role;
