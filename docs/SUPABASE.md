# Supabase handoff — only the work requiring your project access

The demo is runnable immediately without these steps. Use it for the deadline if necessary. Supabase mode is implemented but needs your project configuration and live verification.

## 1. Database

You reported migrations 001, 002 and 003 complete. Do NOT rerun them: their original CREATE statements are not idempotent.

In Supabase SQL Editor, run the complete `database/005_workspace.sql`. It creates cu_workspace, its CAS save RPC, immutable-history trigger, and a private cu-documents Storage bucket. It is safe to rerun. It does not depend on 004, so uncertainty about 004 is not a blocker. Retain 004 as historical source only.

## 2. Backend configuration

Create server/.env locally (copy server/.env.example):

```dotenv
APP_MODE=supabase
PORT=5050
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY=YOUR_BACKEND_ONLY_SECRET_KEY
```

Use the backend secret key from Supabase API Keys (or a legacy service-role key where necessary). It has elevated permissions and must never enter client files, source control, screenshots or chat. The database password is NOT an API key. React receives only the URL and publishable key via /api/config.

No client .env.local is needed in this version. Existing client environment files can be omitted.

## 3. Start

Stop the demo services, then run `npm run dev` from the project root.

On first live startup, the backend reads existing campuses, retains their IDs, supplies missing demo campuses and departments, and initializes fictional operational records into cu_workspace. It does not import your original real-world spreadsheets or alter existing student/fee tables. Existing foundation user roles remain intact. Institution types already present in your campus table are preserved.

Sign in with the real Trust Management account previously created. The demo password does not apply to your real account.

## 4. Provision other live accounts only when needed

The existing Trust Management account is sufficient to open the live prototype. Self-registering into a privileged role is deliberately unavailable.

To create/link another authorized account, open a separate terminal:

```powershell
cd "D:\Hackmitten\campus-unify-ready\server"
npm run provision -- --email "admin-a@example.com" --name "Campus A Administrator" --role campus_admin --campus CAMPUS-A
```

The command prints a generated initial password for newly created accounts. Save it privately. Existing account passwords are unchanged. This is a trusted administrator tool, not an unrestricted web endpoint. Reprovisioning a role retires its previous scopes.

Faculty (first appoint the employee in the UI, then use that employee code):

```powershell
npm run provision -- --email "faculty@example.com" --name "Demo Faculty" --role faculty --campus CAMPUS-A --department CSE --staff-code EMP-12 --class "Year 1 · A" --subject "Computer Fundamentals"
```

HOD:

```powershell
npm run provision -- --email "hod@example.com" --name "Demo HOD" --role hod --campus CAMPUS-A --department CSE --staff-code EMP-11
```

Student:

```powershell
npm run provision -- --email "student@example.com" --name "Demo Student" --role student --student-code ST1001
```

Parent, ONLY after verifying the relationship and any required adult-student authorization:

```powershell
npm run provision -- --email "guardian@example.com" --name "Demo Guardian" --role parent --student-code ST1001 --verified true
```

Warden: use `--role warden --campus CAMPUS-A`; this prototype assigns the campus's sample hostel to that user. It is not a full arbitrary-hostel delegation editor.

Use actual valid email addresses you control for real Auth accounts. No account creation emails are sent by this CLI. For the hackathon use fictional data and appropriate test addresses. A staff appointment alone is not a portal account or a role grant.

## 5. Verify live behavior

- Login, logout and session refresh.
- Trust can load all six campuses.
- Campus admin cannot read another campus.
- Student/parent see only their verified linked student.
- Record a synthetic payment, restart services, confirm persistence.
- Upload/download a synthetic document and test denied cross-student access.
- Confirm publishable-key clients cannot select cu_workspace directly.

Live validation and production deployment are pending user-side steps. Run no destructive reset against an existing workspace. Demo and Supabase stores are separate; demo-mode changes are not automatically migrated into Supabase.
