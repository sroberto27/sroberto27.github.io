-- DTS access model — core schema.
-- See docs/migration/ACCESS-MODEL.md §2 for the normative spec this implements.

create table public.profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  site_role    text not null default 'user' check (site_role in ('user', 'site_admin')),
  display_name text,
  created_at   timestamptz not null default now()
);

-- Every new auth.users row gets a matching profiles row automatically.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, site_role) values (new.id, 'user');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.organizations (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       text not null,
  status     text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now()
);

create table public.organization_members (
  org_id     uuid not null references public.organizations(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  org_role   text not null check (org_role in ('member', 'org_admin')),
  status     text not null default 'active' check (status in ('active', 'invited', 'disabled')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create table public.resource_entitlements (
  id           uuid primary key default gen_random_uuid(),
  resource_key text not null,
  subject_type text not null check (subject_type in ('org', 'user')),
  subject_id   uuid not null,
  granted_by   uuid references auth.users(id),
  created_at   timestamptz not null default now()
);

create table public.client_apps (
  id            uuid primary key default gen_random_uuid(),
  key           text not null unique,
  name          text not null,
  platform      text not null,
  version       text,
  r2_object_key text,
  enabled       boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.events (
  id           uuid primary key default gen_random_uuid(),
  occurred_at  timestamptz not null default now(),
  type         text not null,
  user_id      uuid references auth.users(id),
  anon_id      text,
  org_id       uuid references public.organizations(id),
  resource_key text,
  project_id   text,
  metadata     jsonb
);

create table public.admin_audit (
  id             uuid primary key default gen_random_uuid(),
  occurred_at    timestamptz not null default now(),
  actor_user_id  uuid references auth.users(id),
  action         text not null,
  target_type    text,
  target_id      text,
  org_id         uuid references public.organizations(id),
  before         jsonb,
  after          jsonb
);

create index idx_organization_members_user_id on public.organization_members(user_id);
create index idx_resource_entitlements_resource_key on public.resource_entitlements(resource_key);
create index idx_events_occurred_at_org_id on public.events(occurred_at, org_id);
