-- Persistent adult life is mutable state beside, never inside, canonical_snapshot.
create type public.garden_mature_stage as enum ('active_growth','flourish','stress','dormant','recovery');

alter table public.garden_plants
  add column current_mature_stage public.garden_mature_stage not null default 'active_growth',
  add column garden_health numeric(5,1) not null default 80 check (garden_health between 0 and 100),
  add column garden_hydration numeric(5,1) not null default 70 check (garden_hydration between 0 and 100),
  add column structural_growth numeric(6,1) not null default 400 check (structural_growth between 300 and 480),
  add column foliage_density numeric(5,1) not null default 80 check (foliage_density between 0 and 100),
  add column garden_flower_count integer not null default 0 check (garden_flower_count between 0 and 5),
  add column consecutive_unhealthy_days integer not null default 0 check (consecutive_unhealthy_days >= 0),
  add column consecutive_favorable_days integer not null default 0 check (consecutive_favorable_days >= 0),
  add column dormant_since date;

-- Preserve IDs, placement, ownership and the archival JSON while initializing life
-- from the transfer values for every already-published plant.
update public.garden_plants set
  garden_health = greatest(0, least(100, coalesce((canonical_snapshot->>'health')::numeric, 80))),
  garden_hydration = greatest(0, least(100, coalesce((canonical_snapshot->>'hydration')::numeric, 70))),
  structural_growth = greatest(300, least(480, coalesce((canonical_snapshot->>'totalGrowth')::numeric, 400))),
  foliage_density = greatest(0, least(100, coalesce((canonical_snapshot->>'health')::numeric, 80))),
  garden_flower_count = greatest(0, least(5, coalesce((canonical_snapshot->>'flowerCount')::integer, 0)));

create function public.initialize_garden_mature_life() returns trigger language plpgsql set search_path = '' as $$
begin
  new.garden_health := greatest(0, least(100, coalesce((new.canonical_snapshot->>'health')::numeric, 80)));
  new.garden_hydration := greatest(0, least(100, coalesce((new.canonical_snapshot->>'hydration')::numeric, 70)));
  new.structural_growth := greatest(300, least(480, coalesce((new.canonical_snapshot->>'totalGrowth')::numeric, 400)));
  new.foliage_density := new.garden_health;
  new.garden_flower_count := greatest(0, least(5, coalesce((new.canonical_snapshot->>'flowerCount')::integer, 0)));
  return new;
end $$;
create trigger initialize_garden_mature_life before insert on public.garden_plants
for each row execute function public.initialize_garden_mature_life();

create table public.garden_biome_daily_weather (
  biome public.garden_biome not null, simulated_date date not null,
  temperature_c numeric(5,1) not null, precipitation_mm numeric(6,1) not null check (precipitation_mm >= 0),
  humidity numeric(5,1) not null check (humidity between 0 and 100),
  season text not null check (season in ('winter','spring','summer','fall')),
  created_at timestamptz not null default now(), primary key (biome, simulated_date)
);
alter table public.garden_biome_daily_weather enable row level security;
revoke all on public.garden_biome_daily_weather from anon, authenticated;

-- Scheduler-only daily boundary. Weather is persisted first; conflicting retries
-- fail, plant rows are locked, and last_simulated_date prevents double application.
create function public.simulate_garden_mature_day(p_biome public.garden_biome, p_date date,
  p_temperature_c numeric, p_precipitation_mm numeric, p_humidity numeric, p_season text)
returns integer security definer language plpgsql set search_path = '' as $$
declare p public.garden_plants; hydration numeric; unhealthy boolean; favorable boolean; cold boolean; changed integer := 0; next_stage public.garden_mature_stage;
begin
  insert into public.garden_biome_daily_weather(biome,simulated_date,temperature_c,precipitation_mm,humidity,season)
  values(p_biome,p_date,p_temperature_c,p_precipitation_mm,p_humidity,p_season)
  on conflict (biome,simulated_date) do update set biome=excluded.biome
  where garden_biome_daily_weather.temperature_c=excluded.temperature_c and garden_biome_daily_weather.precipitation_mm=excluded.precipitation_mm
    and garden_biome_daily_weather.humidity=excluded.humidity and garden_biome_daily_weather.season=excluded.season;
  if not found then raise exception 'weather-conflict for % %', p_biome, p_date; end if;
  if exists (select 1 from public.garden_plants gp where gp.biome=p_biome and gp.status='active' and gp.last_simulated_date < p_date - 1) then
    raise exception 'missing garden simulation day before %; catch up chronologically', p_date;
  end if;
  for p in select gp.* from public.garden_plants gp where gp.biome=p_biome and gp.status='active' and gp.last_simulated_date < p_date for update loop
    hydration := greatest(0,least(100,p.garden_hydration + case when p_precipitation_mm>=4 then 12 when p_precipitation_mm>0 then 5 when p_humidity>=70 then -2 else -7 end - case when p_temperature_c>36 then 4 else 0 end));
    cold := p_season='winter' and p_temperature_c<8;
    unhealthy := hydration<35 or p_temperature_c>36 or (not cold and p_temperature_c<2);
    favorable := hydration between 55 and 100 and p_temperature_c between 10 and 30 and not cold;
    next_stage := p.current_mature_stage;
    if cold then next_stage := 'dormant';
    elsif p.current_mature_stage in ('dormant','stress') and favorable then next_stage := 'recovery';
    elsif (case when unhealthy then p.consecutive_unhealthy_days+1 else 0 end)>=2 or p.garden_health<45 then next_stage := 'stress';
    elsif p.current_mature_stage='recovery' and p.garden_health>=72 and hydration>=55 then next_stage := 'active_growth';
    elsif (case when favorable then p.consecutive_favorable_days+1 else 0 end)>=3 and p.garden_health>=88 then next_stage := 'flourish';
    elsif not favorable and p.current_mature_stage='flourish' then next_stage := 'active_growth'; end if;
    update public.garden_plants set current_mature_stage=next_stage, garden_hydration=hydration,
      garden_health=greatest(0,least(100,garden_health + case when next_stage='dormant' then 0 when unhealthy then case when consecutive_unhealthy_days>=3 then -5 else -3 end when favorable then case when next_stage='recovery' then 3 else 2 end else 0 end)),
      structural_growth=greatest(300,least(480,structural_growth + case next_stage when 'flourish' then 2 when 'stress' then -1 when 'recovery' then .5 when 'active_growth' then case when favorable then 1.5 else 0 end else 0 end)),
      foliage_density=greatest(0,least(100,foliage_density + case next_stage when 'flourish' then 3 when 'stress' then -4 when 'dormant' then -2 when 'recovery' then 2 when 'active_growth' then case when favorable then 2 else 0 end end)),
      garden_flower_count=greatest(0,least(5,garden_flower_count + case next_stage when 'flourish' then 1 when 'stress' then -1 when 'dormant' then -2 when 'recovery' then case when garden_health>=75 then 1 else 0 end else 0 end)),
      consecutive_unhealthy_days=case when unhealthy then consecutive_unhealthy_days+1 else 0 end,
      consecutive_favorable_days=case when favorable then consecutive_favorable_days+1 else 0 end,
      dormant_since=case when next_stage='dormant' then coalesce(dormant_since,p_date) else null end,
      last_simulated_date=p_date where id=p.id;
    changed := changed+1;
  end loop;
  return changed;
end $$;
revoke all on function public.simulate_garden_mature_day(public.garden_biome,date,numeric,numeric,numeric,text) from public;
grant execute on function public.simulate_garden_mature_day(public.garden_biome,date,numeric,numeric,numeric,text) to service_role;
grant select, insert on public.garden_biome_daily_weather to service_role;
grant update on public.garden_plants to service_role;
