-- ============================================================
--  NaijaLearn — FULL RECOVERY MIGRATION
--  New Project: https://elawsqcbiuierkeziywz.supabase.co
--
--  Run this ONCE in:
--  Supabase Dashboard → SQL Editor → New query → Run
--
--  Order matters — run the entire script top to bottom.
-- ============================================================


-- ══════════════════════════════════════════════════════════════
-- 1. PROFILES TABLE
--    Extends auth.users. Contains ALL fields used across the
--    codebase: core profile, verification flow, admin flags,
--    suspension, and optional social/contact fields.
-- ══════════════════════════════════════════════════════════════

create table if not exists public.profiles (
  id                        uuid primary key references auth.users(id) on delete cascade,

  -- Core identity
  full_name                 text not null,
  role                      text not null default 'other'
                              check (role in ('teacher','parent','student','other','admin')),
  email                     text,                      -- mirrored for admin search (populated by trigger)
  avatar_url                text,
  bio                       text,
  location                  text,

  -- Contact / social (used by profile.html edit form)
  phone                     text,
  whatsapp                  text,
  twitter                   text,

  -- Verification flow (used by verify.html + admin.html)
  verified                  boolean not null default false,
  verification_status       text not null default 'none'
                              check (verification_status in ('none','pending','approved','rejected')),
  verification_submitted_at timestamptz,
  verification_data         jsonb,                     -- school, state, subjects, years, etc.

  -- Admin controls (used by nav-auth.js + admin.html)
  suspended                 boolean not null default false,

  created_at                timestamptz not null default now()
);

-- Row-Level Security
alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can insert their own profile"
  on public.profiles for insert with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

-- Admins can update any profile (role, suspended, verified, verification_status)
create policy "Admins can update any profile"
  on public.profiles for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- NOTE: The "Public profiles are viewable by everyone" SELECT policy already
-- covers admins reading all rows including email/verification fields.
-- Email is stored in profiles.email (populated by trigger on signup)
-- so the admin panel can search by it without needing auth.admin privileges.


-- ══════════════════════════════════════════════════════════════
-- 2. RESOURCES TABLE
-- ══════════════════════════════════════════════════════════════

create table if not exists public.resources (
  id           bigint generated always as identity primary key,
  title        text not null,
  description  text,
  subject      text not null,
  class_level  text not null,
  term         text not null,
  week         text not null,
  type         text not null check (type in ('Lesson Note','Scheme of Work','Past Questions','Activity')),
  file_url     text not null,
  file_name    text not null,
  file_size    bigint,
  downloads    bigint not null default 0,
  verified     boolean not null default false,
  uploader_id  uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now()
);

-- Full-text search index
alter table public.resources
  add column if not exists fts tsvector
    generated always as (
      to_tsvector('english',
        coalesce(title,'') || ' ' ||
        coalesce(description,'') || ' ' ||
        subject
      )
    ) stored;

create index if not exists resources_fts_idx      on public.resources using gin(fts);
create index if not exists resources_subject_idx  on public.resources (subject);
create index if not exists resources_class_idx    on public.resources (class_level);
create index if not exists resources_uploader_idx on public.resources (uploader_id);

-- Row-Level Security
alter table public.resources enable row level security;

create policy "Anyone can read resources"
  on public.resources for select using (true);

create policy "Authenticated users can insert resources"
  on public.resources for insert
  with check (auth.uid() = uploader_id);

create policy "Uploaders can update their own resources"
  on public.resources for update
  using (auth.uid() = uploader_id);

create policy "Uploaders can delete their own resources"
  on public.resources for delete
  using (auth.uid() = uploader_id);

-- Admins can update/delete any resource
create policy "Admins can update any resource"
  on public.resources for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "Admins can delete any resource"
  on public.resources for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );


-- ══════════════════════════════════════════════════════════════
-- 3. SAVED RESOURCES TABLE
--    Used by resource.html (save/unsave) and dashboard.html
-- ══════════════════════════════════════════════════════════════

create table if not exists public.saved_resources (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  resource_id bigint not null references public.resources(id) on delete cascade,
  saved_at    timestamptz not null default now(),
  unique (user_id, resource_id)
);

create index if not exists saved_resources_user_idx on public.saved_resources (user_id);

alter table public.saved_resources enable row level security;

create policy "Users can view their own saved resources"
  on public.saved_resources for select
  using (auth.uid() = user_id);

create policy "Users can save resources"
  on public.saved_resources for insert
  with check (auth.uid() = user_id);

create policy "Users can unsave their own resources"
  on public.saved_resources for delete
  using (auth.uid() = user_id);


-- ══════════════════════════════════════════════════════════════
-- 4. REVIEWS TABLE
--    Used by resource.html (star ratings + text reviews)
-- ══════════════════════════════════════════════════════════════

create table if not exists public.reviews (
  id           bigint generated always as identity primary key,
  resource_id  bigint not null references public.resources(id) on delete cascade,
  reviewer_id  uuid not null references public.profiles(id) on delete cascade,
  rating       smallint not null check (rating between 1 and 5),
  body         text,
  created_at   timestamptz not null default now(),
  unique (resource_id, reviewer_id)   -- one review per user per resource
);

create index if not exists reviews_resource_idx on public.reviews (resource_id);

alter table public.reviews enable row level security;

create policy "Anyone can read reviews"
  on public.reviews for select using (true);

create policy "Authenticated users can insert reviews"
  on public.reviews for insert
  with check (auth.uid() = reviewer_id);

create policy "Reviewers can delete their own reviews"
  on public.reviews for delete
  using (auth.uid() = reviewer_id);


-- ══════════════════════════════════════════════════════════════
-- 5. INCREMENT DOWNLOADS FUNCTION
--    Called via .rpc('increment_downloads', { resource_id })
--    security definer = runs as DB owner, no auth required
-- ══════════════════════════════════════════════════════════════

create or replace function public.increment_downloads(resource_id bigint)
returns void
language sql
security definer
as $$
  update public.resources
  set downloads = downloads + 1
  where id = resource_id;
$$;


-- ══════════════════════════════════════════════════════════════
-- 6. AUTO-CREATE PROFILE ON SIGNUP TRIGGER
--    Mirrors auth.users → public.profiles on every new signup.
--    Also copies the email field for admin search.
-- ══════════════════════════════════════════════════════════════

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'User'),
    coalesce(new.raw_user_meta_data->>'role', 'other'),
    new.email
  );
  return new;
end;
$$;

-- Drop and recreate to ensure it's clean
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ══════════════════════════════════════════════════════════════
-- 7. STORAGE BUCKETS
--    Two buckets required:
--      • resources  — lesson notes, PDFs, Word, PPT uploads
--      • avatars    — user profile pictures
--    Run these via Dashboard → Storage if the INSERT fails.
-- ══════════════════════════════════════════════════════════════

-- Resources bucket (public — download URLs are shared openly)
insert into storage.buckets (id, name, public)
values ('resources', 'resources', true)
on conflict (id) do nothing;

-- Avatars bucket (public — avatar URLs embedded in UI)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;


-- ══════════════════════════════════════════════════════════════
-- 8. STORAGE RLS POLICIES
-- ══════════════════════════════════════════════════════════════

-- ── Resources bucket ──────────────────────────────────────────

-- Anyone can read resource files (public downloads)
create policy "Public read access to resources bucket"
  on storage.objects for select
  to public
  using (bucket_id = 'resources');

-- Authenticated users can upload to resources bucket
-- Files are stored under {user_id}/timestamp_filename
create policy "Authenticated users can upload resource files"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'resources');

-- Uploaders can delete their own files
-- (folder name = first segment of path = uploader's user id)
create policy "Uploaders can delete their own resource files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'resources'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Admins can delete any resource file
create policy "Admins can delete any resource file"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'resources'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ── Avatars bucket ────────────────────────────────────────────

-- Anyone can view avatars
create policy "Public read access to avatars bucket"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

-- Users can upload/replace their own avatar
-- (path = {user_id}/passport.ext — upsert: true in code)
create policy "Users can upload their own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can update their own avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );


-- ══════════════════════════════════════════════════════════════
-- DONE
-- After running this script, verify in the Supabase Dashboard:
--   • Table Editor: profiles, resources, saved_resources, reviews
--   • Storage: two buckets — "resources" and "avatars"
--   • Authentication → Triggers: on_auth_user_created
--   • Authentication → Email Templates: confirm signup email
--   • Authentication → URL Configuration:
--       Site URL = your deployed URL (or http://localhost for local)
--       Redirect URLs = include your pages/reset-password.html URL
-- ══════════════════════════════════════════════════════════════
