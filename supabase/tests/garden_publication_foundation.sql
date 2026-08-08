begin;
select plan(18);
-- select has_table('public', 'gardens');
-- select has_table('public', 'garden_plots');
-- select has_table('public', 'garden_plants');
-- select has_table('public', 'plant_publication_receipts');
-- select has_function('public', 'publish_completed_plant');
-- select has_function('public', 'garden_layout_cells');
select has_table('public'::name, 'gardens'::name);
select has_table('public'::name, 'garden_plots'::name);
select has_table('public'::name, 'garden_plants'::name);
select has_table('public'::name, 'plant_publication_receipts'::name);
select has_function('public'::name, 'publish_completed_plant'::name);
select has_function('public'::name, 'garden_layout_cells'::name);

select is((select count(*)::integer from public.garden_layout_cells('south')), 96, 'south layout has 96 cells');
select is((select count(*)::integer from public.garden_layout_cells('north')), 96, 'north layout has 96 cells');
select is((select count(*)::integer from public.garden_layout_cells('west')), 96, 'west layout has 96 cells');
select is((select count(*)::integer from public.garden_layout_cells('central')), 96, 'central layout has 96 cells');
select is((select count(*)::integer from public.garden_layout_cells('south') where plot_type='plantable'), 72, 'layout has 72 plantable plots');
select is((select count(distinct (row_number,column_number))::integer from public.garden_layout_cells('south')), 96, 'layout coordinates are unique');
-- select row_security_is('public', 'gardens', true);
-- select row_security_is('public', 'garden_plots', true);
-- select row_security_is('public', 'garden_plants', true);
-- select row_security_is('public', 'plant_publication_receipts', true);

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

select table_privs_are('public', 'gardens', 'anon', array[]::text[]);
select table_privs_are('public', 'garden_plants', 'authenticated', array[]::text[]);
select * from finish();
rollback;
