create extension if not exists pgcrypto with schema extensions;

create table public.account_profiles (
  account_id uuid primary key references auth.users(id) on delete restrict,
  first_name text,
  state_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_profiles_first_name_length check (first_name is null or (char_length(first_name) between 1 and 50)),
  constraint account_profiles_first_name_characters check (first_name is null or first_name ~ '^[[:alpha:] .''-]+$'),
  constraint account_profiles_state_code check (state_code is null or state_code in ('AZ','CA','CO','FL','GA','IL','MA','MI','NC','NY','OH','OR','PA','TX','VA','WA'))
);

create table public.public_contributors (
  id uuid primary key default extensions.gen_random_uuid(),
  account_id uuid unique not null references auth.users(id) on delete restrict,
  public_id text unique not null default ('pc_' || encode(extensions.gen_random_bytes(18), 'hex')),
  display_first_name text,
  state_code text,
  visibility_status text not null default 'private',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint public_contributors_first_name_length check (display_first_name is null or (char_length(display_first_name) between 1 and 50)),
  constraint public_contributors_first_name_characters check (display_first_name is null or display_first_name ~ '^[[:alpha:] .''-]+$'),
  constraint public_contributors_state_code check (state_code is null or state_code in ('AZ','CA','CO','FL','GA','IL','MA','MI','NC','NY','OH','OR','PA','TX','VA','WA')),
  constraint public_contributors_visibility check (visibility_status in ('private','public','hidden')),
  constraint public_contributors_public_id_format check (public_id ~ '^pc_[0-9a-f]{36}$')
);

create function public.set_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;
create trigger account_profiles_updated_at before update on public.account_profiles for each row execute function public.set_updated_at();
create trigger public_contributors_updated_at before update on public.public_contributors for each row execute function public.set_updated_at();

create function public.bootstrap_account() returns trigger security definer language plpgsql set search_path = '' as $$
begin
  insert into public.account_profiles(account_id) values (new.id) on conflict (account_id) do nothing;
  insert into public.public_contributors(account_id) values (new.id) on conflict (account_id) do nothing;
  return new;
end $$;
create trigger auth_user_bootstrap after insert on auth.users for each row execute function public.bootstrap_account();

create function public.sync_contributor_display() returns trigger security definer language plpgsql set search_path = '' as $$
begin
  update public.public_contributors set display_first_name = new.first_name, state_code = new.state_code where account_id = new.account_id;
  return new;
end $$;
create trigger account_profile_display_sync after update of first_name, state_code on public.account_profiles for each row execute function public.sync_contributor_display();

alter table public.account_profiles enable row level security;
alter table public.public_contributors enable row level security;
create policy account_profiles_select_own on public.account_profiles for select to authenticated using ((select auth.uid()) = account_id);
create policy account_profiles_update_own on public.account_profiles for update to authenticated using ((select auth.uid()) = account_id) with check ((select auth.uid()) = account_id);
create policy public_contributors_select_own on public.public_contributors for select to authenticated using ((select auth.uid()) = account_id);

revoke all on public.account_profiles from anon;
revoke all on public.public_contributors from anon;
revoke insert, delete on public.account_profiles from authenticated;
revoke insert, update, delete on public.public_contributors from authenticated;
revoke update on public.account_profiles from authenticated;
grant select on public.account_profiles, public.public_contributors to authenticated;
grant update(first_name, state_code) on public.account_profiles to authenticated;

create view public.public_contributor_projection with (security_invoker = true) as
select public_id as public_contributor_id, display_first_name, state_code, visibility_status
from public.public_contributors;
revoke all on public.public_contributor_projection from anon, authenticated;

comment on view public.public_contributor_projection is 'Future privacy-safe allowlist; not publicly queryable in Phase 1.0.';
