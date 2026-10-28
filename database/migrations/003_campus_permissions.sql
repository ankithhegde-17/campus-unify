begin;

grant select, insert, update
on public.campuses
to authenticated;

-- Trust Management can view all campuses.
-- Campus-scoped staff can view their assigned campus.
create policy campuses_read_authorized
on public.campuses
for select
to authenticated
using (
  exists (
    select 1
    from public.role_assignments ra
    where ra.user_id = (select auth.uid())
      and (
        (
          ra.role_code = 'trust_management'
          and ra.scope = 'trust'
        )
        or ra.campus_id = campuses.id
      )
  )
);

-- Only Trust Management can create campuses.
create policy campuses_insert_trust
on public.campuses
for insert
to authenticated
with check (
  exists (
    select 1
    from public.role_assignments ra
    where ra.user_id = (select auth.uid())
      and ra.role_code = 'trust_management'
      and ra.scope = 'trust'
  )
);

-- Only Trust Management can update campuses.
create policy campuses_update_trust
on public.campuses
for update
to authenticated
using (
  exists (
    select 1
    from public.role_assignments ra
    where ra.user_id = (select auth.uid())
      and ra.role_code = 'trust_management'
      and ra.scope = 'trust'
  )
)
with check (
  exists (
    select 1
    from public.role_assignments ra
    where ra.user_id = (select auth.uid())
      and ra.role_code = 'trust_management'
      and ra.scope = 'trust'
  )
);

-- Prevent blank campus codes and names.
alter table public.campuses
add constraint campuses_code_not_blank
check (length(trim(code)) > 0);

alter table public.campuses
add constraint campuses_name_not_blank
check (length(trim(name)) > 0);

commit;