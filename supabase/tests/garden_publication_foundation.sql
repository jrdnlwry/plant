begin;

select plan(24);

select has_table('public'::name, 'gardens'::name);
select has_table('public'::name, 'garden_plots'::name);
select has_table('public'::name, 'garden_plants'::name);
select has_table('public'::name, 'plant_publication_receipts'::name);
select has_function('public'::name, 'publish_completed_plant'::name);
select has_function('public'::name, 'garden_layout_cells'::name);

select is(
  (
    select count(*)::integer
    from public.garden_layout_cells('south')
  ),
  96,
  'south layout has 96 cells'
);

select is(
  (
    select count(*)::integer
    from public.garden_layout_cells('north')
  ),
  96,
  'north layout has 96 cells'
);

select is(
  (
    select count(*)::integer
    from public.garden_layout_cells('west')
  ),
  96,
  'west layout has 96 cells'
);

select is(
  (
    select count(*)::integer
    from public.garden_layout_cells('central')
  ),
  96,
  'central layout has 96 cells'
);

select is(
  (
    select count(*)::integer
    from public.garden_layout_cells('south')
    where plot_type = 'plantable'
  ),
  72,
  'layout has 72 plantable plots'
);

select is(
  (
    select count(distinct (row_number, column_number))::integer
    from public.garden_layout_cells('south')
  ),
  96,
  'layout coordinates are unique'
);

select ok(
  (
    select relrowsecurity
    from pg_catalog.pg_class
    where oid = 'public.gardens'::regclass
  ),
  'RLS is enabled on public.gardens'
);

select ok(
  (
    select relrowsecurity
    from pg_catalog.pg_class
    where oid = 'public.garden_plots'::regclass
  ),
  'RLS is enabled on public.garden_plots'
);

select ok(
  (
    select relrowsecurity
    from pg_catalog.pg_class
    where oid = 'public.garden_plants'::regclass
  ),
  'RLS is enabled on public.garden_plants'
);

select ok(
  (
    select relrowsecurity
    from pg_catalog.pg_class
    where oid = 'public.plant_publication_receipts'::regclass
  ),
  'RLS is enabled on public.plant_publication_receipts'
);

select table_privs_are(
  'public',
  'gardens',
  'anon',
  array[]::text[]
);

select table_privs_are(
  'public',
  'garden_plants',
  'authenticated',
  array[]::text[]
);

select has_table_privilege(
  'service_role',
  'public.gardens',
  'SELECT'
);

select has_table_privilege(
  'service_role',
  'public.garden_plots',
  'SELECT'
);

select has_table_privilege(
  'service_role',
  'public.garden_plants',
  'SELECT'
);

select has_table_privilege(
  'service_role',
  'public.public_contributors',
  'SELECT'
);

select has_table_privilege(
  'service_role',
  'public.plant_publication_receipts',
  'SELECT'
);

select has_function_privilege(
  'service_role',
  'public.publish_completed_plant(uuid,text,public.garden_biome,text,text,text,text,text,jsonb,integer,text,timestamptz,timestamptz)',
  'EXECUTE'
);

select * from finish();

rollback;