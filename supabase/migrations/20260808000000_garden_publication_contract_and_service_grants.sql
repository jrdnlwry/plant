-- Backend API access remains behind RLS and the service-role credential. Grant only
-- the operations used by account linking, publication, receipts, and public reads.
grant select, insert, update on table public.extension_installations to service_role;
grant select, insert, update on table public.account_link_challenges to service_role;
grant select, insert, update on table public.installation_credentials to service_role;
grant select on table public.account_profiles to service_role;
grant select, insert, update on table public.public_contributors to service_role;
grant select on table public.gardens, public.garden_plots, public.garden_plants to service_role;
grant select on table public.plant_publication_receipts to service_role;

grant execute on function public.publish_completed_plant(uuid,text,public.garden_biome,text,text,text,text,text,jsonb,integer,text,timestamptz,timestamptz) to service_role;

-- Publications accepted before the canonicalization boundary stored the extension's
-- otherwise-compatible legacy finalState directly. Complete only missing contract
-- fields so those immutable archived plants become readable; never overwrite an
-- explicit (and potentially incompatible) version.
update public.garden_plants
set canonical_snapshot = canonical_snapshot
  || jsonb_build_object('schemaVersion', 1)
  || jsonb_build_object('rendererVersion', 'l-system-pixel-v2')
  || case when canonical_snapshot ? 'weather' then '{}'::jsonb else jsonb_build_object('weather', null) end
  || case when canonical_snapshot ? 'weatherUpdatedAt' then '{}'::jsonb else jsonb_build_object('weatherUpdatedAt', null) end
where not (canonical_snapshot ? 'schemaVersion')
  and not (canonical_snapshot ? 'rendererVersion')
  and renderer_snapshot_version = 1;
