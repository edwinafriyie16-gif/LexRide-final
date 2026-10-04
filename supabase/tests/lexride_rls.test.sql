begin;
select plan(5);

select ok(
  exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and left(c.relname, 8) = 'lexride_'
  ),
  'public LexRide tables exist'
);

select ok(
  not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and left(c.relname, 8) = 'lexride_'
      and not c.relrowsecurity
  ),
  'RLS is enabled on every public LexRide table'
);

select ok(
  not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and left(c.relname, 8) = 'lexride_'
      and (
        has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        or has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      )
  ),
  'anon and authenticated have no direct LexRide table privileges'
);

select ok(
  not exists (
    select 1
    from pg_class seq
    join pg_namespace seq_ns on seq_ns.oid = seq.relnamespace
    join pg_depend dep on dep.objid = seq.oid
      and dep.classid = 'pg_class'::regclass
      and dep.refclassid = 'pg_class'::regclass
      and dep.deptype in ('a', 'i')
    join pg_class tbl on tbl.oid = dep.refobjid
    join pg_namespace tbl_ns on tbl_ns.oid = tbl.relnamespace
    where seq.relkind = 'S'
      and tbl_ns.nspname = 'public'
      and left(tbl.relname, 8) = 'lexride_'
      and (
        has_sequence_privilege('anon', seq.oid, 'USAGE')
        or has_sequence_privilege('anon', seq.oid, 'SELECT')
        or has_sequence_privilege('anon', seq.oid, 'UPDATE')
        or has_sequence_privilege('authenticated', seq.oid, 'USAGE')
        or has_sequence_privilege('authenticated', seq.oid, 'SELECT')
        or has_sequence_privilege('authenticated', seq.oid, 'UPDATE')
      )
  ),
  'anon and authenticated have no LexRide sequence privileges'
);

select ok(
  not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and left(c.relname, 8) = 'lexride_'
      and not has_table_privilege('service_role', c.oid, 'SELECT,INSERT,UPDATE,DELETE')
  ),
  'service_role retains the table privileges required by the server API'
);

select * from finish();
rollback;
