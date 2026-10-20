-- TribalScholar AI: run once in Supabase SQL Editor on a new project.
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null default '',
 role text not null default 'student' check (role in ('student','admin')),
 created_at timestamptz not null default now()
);
create table public.scholarships (
 id bigint generated always as identity primary key,
 title text not null,
 description text not null default '',
 eligibility text not null default '',
 deadline date,
 status text not null default 'open' check (status in ('open','closed')),
 created_at timestamptz not null default now()
);
create table public.applications (
 id bigint generated always as identity primary key,
 student_id uuid not null references public.profiles(id) on delete cascade,
 scholarship_id bigint not null references public.scholarships(id),
 statement text not null default '',
 status text not null default 'submitted' check (status in ('submitted','under_review','approved','rejected')),
 admin_note text not null default '',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(student_id,scholarship_id)
);
create table public.announcements (
 id bigint generated always as identity primary key,
 title text not null,
 body text not null,
 created_at timestamptz not null default now()
);
-- Create profile on signup; do not accept a role from user metadata.
create or replace function public.create_profile_for_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(id, full_name, role)
 values(new.id, coalesce(new.raw_user_meta_data ->> 'full_name',''), 'student');
 return new;
end;
$$;
create trigger on_auth_user_created
 after insert on auth.users for each row execute function public.create_profile_for_new_user();
-- Admin membership check. Definer avoids RLS recursion.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.profiles where id = (select auth.uid()) and role = 'admin');
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;
-- RLS for every exposed table.
alter table public.profiles enable row level security;
alter table public.scholarships enable row level security;
alter table public.applications enable row level security;
alter table public.announcements enable row level security;
create policy "Profile self or admin read" on public.profiles for select to authenticated using (id = (select auth.uid()) or (select public.is_admin()));
-- Profiles have no client update policy: users cannot promote themselves.
create policy "Scholarships public read" on public.scholarships for select to anon, authenticated using (true);
create policy "Admin add scholarships" on public.scholarships for insert to authenticated with check ((select public.is_admin()));
create policy "Admin edit scholarships" on public.scholarships for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admin delete scholarships" on public.scholarships for delete to authenticated using ((select public.is_admin()));
create policy "Read own applications or admin" on public.applications for select to authenticated using (student_id = (select auth.uid()) or (select public.is_admin()));
-- Students insert only with the submitted status; no student UPDATE policy.
create policy "Students submit applications" on public.applications for insert to authenticated with check (
 student_id = (select auth.uid()) and status = 'submitted' and admin_note = ''
 and exists(select 1 from public.scholarships s where s.id = scholarship_id and s.status = 'open' and (s.deadline is null or s.deadline >= current_date))
);
create policy "Admin update applications" on public.applications for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Announcements public read" on public.announcements for select to anon, authenticated using (true);
create policy "Admin create announcements" on public.announcements for insert to authenticated with check ((select public.is_admin()));
create policy "Admin edit announcements" on public.announcements for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admin delete announcements" on public.announcements for delete to authenticated using ((select public.is_admin()));
-- Demo seed data, not real government eligibility criteria.
insert into public.scholarships(title,description,eligibility,deadline) values
('Demo Undergraduate Scholarship','Fictional scholarship for testing.','Undergraduate students', '2027-06-30'),
('Demo Research Fellowship','Fictional fellowship for testing.','Research students', '2027-06-30');
-- AFTER creating your own admin account via normal Supabase signup, run this
-- separately in SQL Editor, replacing the example email with your real admin email:
-- update public.profiles set role = 'admin'
-- where id = (select id from auth.users where email = 'your-admin-email@example.com');
