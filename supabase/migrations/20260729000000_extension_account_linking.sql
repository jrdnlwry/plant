create table public.extension_installations (
  installation_id text primary key,
  account_id uuid references auth.users(id) on delete restrict,
  public_contributor_id uuid references public.public_contributors(id) on delete restrict,
  linked_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint extension_installation_id_format check (installation_id ~ '^inst_[0-9a-f]{32,64}$'),
  constraint extension_installation_link_consistent check ((account_id is null) = (public_contributor_id is null))
);

create table public.account_link_challenges (
  id uuid primary key default extensions.gen_random_uuid(),
  challenge_id text unique not null default ('link_' || encode(extensions.gen_random_bytes(18), 'hex')),
  installation_id text not null references public.extension_installations(installation_id) on delete restrict,
  token_hash text unique not null,
  status text not null default 'pending',
  expires_at timestamptz not null,
  approved_by_account_id uuid references auth.users(id) on delete restrict,
  approved_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint account_link_status check (status in ('pending','approved','expired','cancelled','consumed')),
  constraint account_link_token_hash check (token_hash ~ '^[0-9a-f]{64}$')
);
create unique index account_link_one_pending_per_installation on public.account_link_challenges(installation_id) where status = 'pending';
create index account_link_token_lookup on public.account_link_challenges(token_hash);
create index account_link_expiry_status on public.account_link_challenges(status, expires_at);

create table public.installation_credentials (
  id uuid primary key default extensions.gen_random_uuid(),
  installation_id text not null unique references public.extension_installations(installation_id) on delete restrict,
  credential_hash text unique not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint installation_credential_hash check (credential_hash ~ '^[0-9a-f]{64}$')
);
create index installation_credential_lookup on public.installation_credentials(credential_hash);

create trigger extension_installations_updated_at before update on public.extension_installations for each row execute function public.set_updated_at();

alter table public.extension_installations enable row level security;
alter table public.account_link_challenges enable row level security;
alter table public.installation_credentials enable row level security;
revoke all on public.extension_installations, public.account_link_challenges, public.installation_credentials from anon, authenticated;

-- The authenticated caller identity is authoritative. Row locking makes approval single-account and idempotent.
create function public.approve_extension_link(p_token_hash text) returns jsonb
security definer language plpgsql set search_path = '' as $$
declare c public.account_link_challenges; p public.account_profiles; pc public.public_contributors; i public.extension_installations;
begin
  if auth.uid() is null then return jsonb_build_object('error', 'authentication-required'); end if;
  select * into c from public.account_link_challenges where token_hash = p_token_hash for update;
  if not found then return jsonb_build_object('error', 'invalid-challenge'); end if;
  if c.expires_at <= now() and c.status = 'pending' then
    update public.account_link_challenges set status = 'expired' where id = c.id;
    return jsonb_build_object('error', 'expired-challenge');
  end if;
  if c.status in ('approved','consumed') and c.approved_by_account_id = auth.uid() then
    return jsonb_build_object('status', c.status, 'challengeId', c.challenge_id);
  end if;
  if c.status <> 'pending' then return jsonb_build_object('error', 'challenge-consumed'); end if;
  select * into p from public.account_profiles where account_id = auth.uid();
  if p.first_name is null or p.state_code is null then return jsonb_build_object('error', 'profile-incomplete'); end if;
  select * into pc from public.public_contributors where account_id = auth.uid();
  select * into i from public.extension_installations where installation_id = c.installation_id for update;
  if i.revoked_at is not null then return jsonb_build_object('error', 'installation-revoked'); end if;
  if i.account_id is not null and i.account_id <> auth.uid() then return jsonb_build_object('error', 'installation-already-linked'); end if;
  update public.extension_installations set account_id = auth.uid(), public_contributor_id = pc.id, linked_at = coalesce(linked_at, now()) where installation_id = c.installation_id;
  update public.account_link_challenges set status = 'approved', approved_by_account_id = auth.uid(), approved_at = now() where id = c.id;
  return jsonb_build_object('status', 'approved', 'challengeId', c.challenge_id);
end $$;
revoke all on function public.approve_extension_link(text) from public;
grant execute on function public.approve_extension_link(text) to authenticated;

create function public.inspect_extension_link_challenge(p_token_hash text) returns jsonb
security definer language plpgsql stable set search_path = '' as $$
declare c public.account_link_challenges;
begin
  if auth.uid() is null then return jsonb_build_object('error', 'authentication-required'); end if;
  select * into c from public.account_link_challenges where token_hash = p_token_hash;
  if not found then return jsonb_build_object('status', 'invalid'); end if;
  return jsonb_build_object('status', case when c.status = 'pending' and c.expires_at <= now() then 'expired' else c.status end, 'expiresAt', c.expires_at);
end $$;
revoke all on function public.inspect_extension_link_challenge(text) from public;
grant execute on function public.inspect_extension_link_challenge(text) to authenticated;
