begin;
select plan(10);
select has_table('public', 'account_profiles', 'private profile table exists');
select has_table('public', 'public_contributors', 'contributor table exists');
select ok(
  exists (
    select 1
    from pg_constraint constraint_record
    join pg_class table_record
      on table_record.oid = constraint_record.conrelid
    join pg_namespace schema_record
      on schema_record.oid = table_record.relnamespace
    where schema_record.nspname = 'public'
      and table_record.relname = 'account_profiles'
      and constraint_record.conname =
        'account_profiles_first_name_characters'
      and constraint_record.contype = 'c'
  ),
  'private profile enforces the first-name character allowlist'
);
select ok(
  exists (
    select 1
    from pg_constraint constraint_record
    join pg_class table_record
      on table_record.oid = constraint_record.conrelid
    join pg_namespace schema_record
      on schema_record.oid = table_record.relnamespace
    where schema_record.nspname = 'public'
      and table_record.relname = 'public_contributors'
      and constraint_record.conname =
        'public_contributors_first_name_characters'
      and constraint_record.contype = 'c'
  ),
  'synced contributor name enforces the character allowlist'
);


select ok(
  (
    select table_record.relrowsecurity
    from pg_class table_record
    join pg_namespace schema_record
      on schema_record.oid = table_record.relnamespace
    where schema_record.nspname = 'public'
      and table_record.relname = 'account_profiles'
  ),
  'profile RLS active'
);

select ok(
  (
    select table_record.relrowsecurity
    from pg_class table_record
    join pg_namespace schema_record
      on schema_record.oid = table_record.relnamespace
    where schema_record.nspname = 'public'
      and table_record.relname = 'public_contributors'
  ),
  'contributor RLS active'
);

select has_column('public', 'public_contributor_projection', 'public_contributor_id', 'projection has public ID');


select hasnt_column(
  'public',
  'public_contributor_projection',
  'account_id',
  'projection omits account ID'
);

select hasnt_column(
  'public',
  'account_profiles',
  'latitude',
  'profiles omit exact latitude'
);

select hasnt_column(
  'public',
  'account_profiles',
  'longitude',
  'profiles omit exact longitude'
);


select * from finish();
rollback;
