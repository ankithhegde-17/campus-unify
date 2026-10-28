-- Dummy data: 10,000 fictional students.
-- Run in Supabase SQL Editor after migrations 001–003. Runs as one transaction.
--
-- Creates, per student: auth.users + auth.identities (so the account can sign in),
-- public.profiles, and one public.role_assignments row (role 'student', scope 'self').
--
-- Every account uses the email domain @students.campus-unify.test and the
-- password Demo@12345. Remove everything with seed_10000_students_cleanup.sql.
--
-- Note: the valid_role_scope check forces students to scope 'self' with no
-- campus_id/department_id, so these students are not linked to a campus.

begin;

-- Refuse to run twice.
do $$
begin
  if exists (
    select 1 from auth.users where email like '%@students.campus-unify.test'
  ) then
    raise exception 'Dummy students already exist. Run seed_10000_students_cleanup.sql first.';
  end if;
end $$;

create temporary table seed_students on commit drop as
with names as (
  select
    array[
      'Aarav','Vivaan','Aditya','Vihaan','Arjun','Sai','Reyansh','Ayaan','Krishna','Ishaan',
      'Shaurya','Atharv','Advik','Pranav','Rohan','Karthik','Nikhil','Rahul','Varun','Siddharth',
      'Ananya','Diya','Aadhya','Saanvi','Pari','Ira','Myra','Anika','Navya','Kavya',
      'Meera','Riya','Sneha','Pooja','Divya','Lakshmi','Shreya','Nandini','Priya','Tanvi',
      'Harsha','Manoj','Suresh','Deepak','Akash','Yash','Kiran','Abhishek','Gaurav','Tejas'
    ] as first_names,
    array[
      'Sharma','Verma','Iyer','Nair','Reddy','Rao','Hegde','Shetty','Kulkarni','Patil',
      'Joshi','Desai','Menon','Pillai','Gowda','Naik','Kamath','Bhat','Pai','Shenoy',
      'Gupta','Agarwal','Mehta','Shah','Singh','Kumar','Das','Banerjee','Mukherjee','Chatterjee',
      'Mishra','Pandey','Tiwari','Yadav','Chauhan','Malhotra','Kapoor','Khanna','Bose','Ghosh'
    ] as last_names
),
base as (
  select
    g as n,
    gen_random_uuid() as id,
    -- Different strides so first/last name pairs don't repeat in a short cycle.
    n.first_names[1 + (g * 7) % array_length(n.first_names, 1)] as first_name,
    n.last_names[1 + (g * 13 + g / 40) % array_length(n.last_names, 1)] as last_name,
    -- Admission dates spread over the last four academic years.
    (date '2022-07-01' + ((g * 37) % 1460) * interval '1 day'
      + ((g * 53) % 36000) * interval '1 second') as joined_at
  from generate_series(1, 10000) as g
  cross join names n
)
select
  n,
  id,
  first_name || ' ' || last_name as full_name,
  'student' || lpad(n::text, 5, '0') || '@students.campus-unify.test' as email,
  least(joined_at, now() - interval '1 day') as joined_at,
  -- ~3% inactive profiles, ~6% graduated (ended), ~2% revoked.
  (n % 33 <> 0) as is_active,
  case when n % 17 = 0 then least(joined_at, now() - interval '1 day') + interval '4 years' end as ends_at,
  case when n % 50 = 0 then least(joined_at, now() - interval '1 day') + interval '200 days' end as revoked_at
from base;

-- One bcrypt hash shared by all dummy accounts (hashing 10,000 times is slow).
create temporary table seed_password on commit drop as
select extensions.crypt('Demo@12345', extensions.gen_salt('bf')) as hash;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000', s.id, 'authenticated', 'authenticated',
  s.email, p.hash,
  s.joined_at,
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', s.full_name, 'dummy', true),
  s.joined_at, s.joined_at,
  '', '', '', ''
from seed_students s
cross join seed_password p;

insert into auth.identities (
  id, user_id, provider_id, provider, identity_data,
  last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(), s.id, s.id::text, 'email',
  jsonb_build_object('sub', s.id::text, 'email', s.email, 'email_verified', true),
  null, s.joined_at, s.joined_at
from seed_students s;

-- on conflict covers projects where a trigger already creates profiles.
insert into public.profiles (id, full_name, is_active, created_at)
select id, full_name, is_active, joined_at
from seed_students
on conflict (id) do update
  set full_name = excluded.full_name,
      is_active = excluded.is_active,
      created_at = excluded.created_at;

insert into public.role_assignments (
  user_id, role_code, scope, campus_id, department_id,
  starts_at, ends_at, revoked_at, granted_by, created_at
)
select
  s.id, 'student', 'self', null, null,
  s.joined_at, s.ends_at, s.revoked_at,
  -- Attribute grants to an existing system admin / trust manager, if any.
  (
    select ra.user_id
    from public.role_assignments ra
    where ra.role_code in ('system_admin', 'trust_management')
      and ra.revoked_at is null
    order by ra.created_at
    limit 1
  ),
  s.joined_at
from seed_students s;

commit;

-- Quick check:
-- select count(*) from public.role_assignments where role_code = 'student';
