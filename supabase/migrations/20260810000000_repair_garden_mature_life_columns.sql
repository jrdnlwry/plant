-- Forward repair for databases that recorded newer migration versions before
-- 20260808010000 was introduced. Keep this additive and idempotent so it is safe
-- both after the complete mature-life migration and on the affected schema.
do $$ begin
  create type public.garden_mature_stage as enum ('active_growth','flourish','stress','dormant','recovery');
exception when duplicate_object then null;
end $$;

do $$
declare needs_backfill boolean;
begin
  select not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'garden_plants' and column_name = 'current_mature_stage'
  ) into needs_backfill;

  alter table public.garden_plants
    add column if not exists current_mature_stage public.garden_mature_stage not null default 'active_growth',
    add column if not exists garden_health numeric(5,1) not null default 80 check (garden_health between 0 and 100),
    add column if not exists garden_hydration numeric(5,1) not null default 70 check (garden_hydration between 0 and 100),
    add column if not exists structural_growth numeric(6,1) not null default 400 check (structural_growth between 300 and 480),
    add column if not exists foliage_density numeric(5,1) not null default 80 check (foliage_density between 0 and 100),
    add column if not exists garden_flower_count integer not null default 0 check (garden_flower_count between 0 and 5),
    add column if not exists consecutive_unhealthy_days integer not null default 0 check (consecutive_unhealthy_days >= 0),
    add column if not exists consecutive_favorable_days integer not null default 0 check (consecutive_favorable_days >= 0),
    add column if not exists dormant_since date;

  -- Match the original backfill only when repairing the absent schema. Never
  -- overwrite mutable life state in a database that already has these columns.
  if needs_backfill then
    update public.garden_plants set
      garden_health = greatest(0, least(100, coalesce((canonical_snapshot->>'health')::numeric, garden_health))),
      garden_hydration = greatest(0, least(100, coalesce((canonical_snapshot->>'hydration')::numeric, garden_hydration))),
      structural_growth = greatest(300, least(480, coalesce((canonical_snapshot->>'totalGrowth')::numeric, structural_growth))),
      foliage_density = greatest(0, least(100, coalesce((canonical_snapshot->>'health')::numeric, foliage_density))),
      garden_flower_count = greatest(0, least(5, coalesce((canonical_snapshot->>'flowerCount')::integer, garden_flower_count)));
  end if;
end $$;
