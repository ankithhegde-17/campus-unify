begin;

grant select on public.profiles to authenticated;
grant select on public.role_assignments to authenticated;
grant select on public.roles to authenticated;

-- Users can read their own profile.
create policy profiles_read_own
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
);

-- Active users can read their own current role assignments.
create policy role_assignments_read_own
on public.role_assignments
for select
to authenticated
using (
  user_id = (select auth.uid())
  and revoked_at is null
  and starts_at <= now()
  and (ends_at is null or ends_at > now())
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.is_active = true
  )
);

-- Users can read the names of their assigned roles.
create policy roles_read_assigned
on public.roles
for select
to authenticated
using (
  exists (
    select 1
    from public.role_assignments ra
    where ra.role_code = roles.code
      and ra.user_id = (select auth.uid())
  )
);

commit;