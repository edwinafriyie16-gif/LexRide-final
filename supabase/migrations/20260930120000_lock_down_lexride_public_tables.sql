-- LexRide accesses Supabase only through its authenticated server API.
-- No anon/authenticated policies are intentionally created: those roles must
-- not read or mutate LexRide tables directly through the Supabase Data API.
-- Server handlers enforce account, trip-owner, and approved-member access
-- before using SUPABASE_SERVICE_ROLE_KEY, which remains server-only.

do $$
declare
  target record;
  secured_table_count integer := 0;
begin
  for target in
    select n.nspname as schema_name, c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and left(c.relname, 8) = 'lexride_'
  loop
    execute format('alter table %I.%I enable row level security', target.schema_name, target.table_name);
    execute format('revoke all privileges on table %I.%I from public, anon, authenticated', target.schema_name, target.table_name);
    execute format('grant all privileges on table %I.%I to service_role', target.schema_name, target.table_name);
    secured_table_count := secured_table_count + 1;
  end loop;

  if secured_table_count = 0 then
    raise exception 'No public LexRide tables found; refusing to report a successful RLS migration';
  end if;

  for target in
    select seq_ns.nspname as schema_name, seq.relname as sequence_name
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
  loop
    execute format('revoke all privileges on sequence %I.%I from public, anon, authenticated', target.schema_name, target.sequence_name);
    execute format('grant usage, select, update on sequence %I.%I to service_role', target.schema_name, target.sequence_name);
  end loop;
end;
$$;
