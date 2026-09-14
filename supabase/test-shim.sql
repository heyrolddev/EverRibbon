--
-- Enough of the hosting platform's own surface to load this schema into a
-- plain Postgres.
--
-- Not a reimplementation and never deployed: the migrations reference
-- auth.uid(), auth.users, storage.objects and the realtime publication, all of
-- which the platform provides. Without these the schema cannot be loaded
-- anywhere else, which would mean the only way to find out whether a migration
-- works is to run it against the shop's real database.
--
-- auth.uid() returns null here, which is exactly what an anonymous request
-- looks like -- so the row-level security policies are exercised in their
-- strictest state rather than bypassed.
--
-- to, so the schema can be replayed and inspected outside the platform.
-- Roles live in the cluster, not the database, so a second run finds them.
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
-- Returns the signed-in user. Null here, which is what an anonymous request
-- looks like, and the RLS policies are written expecting exactly that.
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create or replace function auth.role() returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon')
$$;

create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key, name text, public boolean default false,
  created_at timestamptz default now()
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text, owner uuid, created_at timestamptz default now(),
  metadata jsonb
);
alter table storage.objects enable row level security;

-- Supabase creates this; migrations add tables to it to turn on realtime.
do $$ begin
  if not exists (select 1 from pg_publication where pubname='supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;
