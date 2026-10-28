begin;

grant select, insert, update
on public.departments
to authenticated;

-- Users can read departments within their permitted campus.
-- Trust Management can read departments across all campuses.
create policy departments_read_authorized
on public.departments
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
        or ra.campus_id = departments.campus_id
      )
  )
);

-- Trust Management and the assigned Campus Administrator
-- can create departments.
create policy departments_insert_authorized
on public.departments
for insert
to authenticated
with check (
  exists (
    select 1
    from public.role_assignments ra
    where ra.user_id = (select auth.uid())
      and (
        (
          ra.role_code = 'trust_management'
          and ra.scope = 'trust'
        )
        or (
          ra.role_code = 'campus_admin'
          and ra.scope = 'campus'
          and ra.campus_id = departments.campus_id
        )
      )
  )
);

-- The same authorized roles can update departments.
create policy departments_update_authorized
on public.departments
for update
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
        or (
          ra.role_code = 'campus_admin'
          and ra.scope = 'campus'
          and ra.campus_id = departments.campus_id
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.role_assignments ra
    where ra.user_id = (select auth.uid())
      and (
        (
          ra.role_code = 'trust_management'
          and ra.scope = 'trust'
        )
        or (
          ra.role_code = 'campus_admin'
          and ra.scope = 'campus'
          and ra.campus_id = departments.campus_id
        )
      )
  )
);

alter table public.departments
add constraint departments_code_not_blank
check (length(trim(code)) > 0);

alter table public.departments
add constraint departments_name_not_blank
check (length(trim(name)) > 0);

commit;