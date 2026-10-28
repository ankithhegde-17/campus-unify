begin;

-- Institutions belonging to this trust.
create table public.campuses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  institution_type text not null
    check (institution_type in (
      'engineering', 'polytechnic', 'school', 'other'
    )),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- A department belongs to one campus.
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  campus_id uuid not null references public.campuses(id),
  code text not null,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),

  unique (campus_id, code),
  unique (id, campus_id)
);

-- Application profile linked to an existing Supabase Auth user.
-- No password is stored here.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  full_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Available application roles.
create table public.roles (
  code text primary key,
  name text not null
);

insert into public.roles (code, name)
values
  ('trust_management', 'Trust Management'),
  ('system_admin', 'System Administrator'),
  ('campus_admin', 'Campus Administrator'),
  ('admissions_officer', 'Admissions Officer'),
  ('accounts_officer', 'Accounts Officer'),
  ('hod', 'Head of Department'),
  ('faculty', 'Faculty'),
  ('warden', 'Hostel Warden'),
  ('student', 'Student'),
  ('parent', 'Parent or Guardian'),
  ('auditor', 'Auditor');

-- One account may have multiple scoped roles.
create table public.role_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  role_code text not null references public.roles(code),

  scope text not null
    check (scope in ('trust', 'campus', 'department', 'self')),

  campus_id uuid references public.campuses(id),
  department_id uuid,

  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  revoked_at timestamptz,

  granted_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),

  foreign key (department_id, campus_id)
    references public.departments(id, campus_id),

  constraint valid_assignment_dates check (
    ends_at is null or ends_at > starts_at
  ),

  constraint valid_scope_fields check (
    (
      scope = 'trust'
      and campus_id is null
      and department_id is null
    )
    or
    (
      scope = 'campus'
      and campus_id is not null
      and department_id is null
    )
    or
    (
      scope = 'department'
      and campus_id is not null
      and department_id is not null
    )
    or
    (
      scope = 'self'
      and campus_id is null
      and department_id is null
    )
  ),

  constraint valid_role_scope check (
    (
      role_code in ('trust_management', 'system_admin')
      and scope = 'trust'
    )
    or
    (
      role_code in (
        'campus_admin', 'admissions_officer',
        'accounts_officer', 'faculty', 'warden'
      )
      and scope = 'campus'
    )
    or
    (
      role_code = 'hod'
      and scope = 'department'
    )
    or
    (
      role_code in ('student', 'parent')
      and scope = 'self'
    )
    or
    (
      role_code = 'auditor'
      and scope in ('trust', 'campus')
    )
  )
);

create index role_assignments_user_idx
  on public.role_assignments(user_id);

create index role_assignments_campus_idx
  on public.role_assignments(campus_id);

create index role_assignments_department_idx
  on public.role_assignments(department_id);

-- Start with API access denied until explicit policies are added.
alter table public.campuses enable row level security;
alter table public.departments enable row level security;
alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.role_assignments enable row level security;

commit;