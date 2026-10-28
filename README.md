# Campus Unify

A React + Express educational trust operations prototype for six campuses. Built from the supplied VS Code starter and the ER-03 problem statement. All bundled records are fictional.

## Start the demo in one terminal

Use Node.js 24 LTS (your existing Node 24 is suitable). Stop your old React/Express terminals first. Extract this project into a NEW folder; do not copy its files into a running old project.

```powershell
cd "D:\Hackmitten\campus-unify-ready"
npm run setup
npm run dev
```

Use the actual folder containing this README and the root package.json. Open http://localhost:5173. If extraction creates another campus-unify folder, enter that folder first.

No environment file is required in demo mode. If reusing an old server/.env, add APP_MODE=demo explicitly. Demo changes persist in server/data/workspace.json, not browser storage. Restarting the server signs demo accounts out but preserves records.

**Demo login:** choose a stakeholder from the login selector. All demo accounts use `Demo@12345` and `<role>@demo.local`, e.g. `trust_management@demo.local`. These credentials work ONLY in demo mode. The server runs on the local loopback interface; this is not a public production deployment.

## What is implemented

- Responsive role-specific dashboard, campus selector, directory search, filters, pagination, helpful error states, confirmation dialogs.
- Eleven stakeholder roles; server-enforced record and field access.
- Six campuses A–F, 12 departments, 72 student identities, 18 staff appointments, 96 hostel beds and synthetic operational history.
- Admission registration, confirmation and automatic tuition charge using an effective campus rule.
- Private PDF/PNG/JPEG admission documents up to 500 KB; document verification and rejection.
- Staff appointment, HOD designation, linked faculty teaching assignments, staff transfer and separation with access revocation for linked users.
- Fee balances, payment reference deduplication, immutable receipt records, receipt CSV download, concessions, independent reversal/refund approval.
- Class sessions, attendance marking, locking, approved corrections, missing-entry counts and campus attendance thresholds.
- Bed allocation/check-out, occupancy, concurrent allocation protection, automatic accommodation charge and accommodation requests.
- Scholarship application entry and approval/claim/received stages; only received reimbursement counts as payment.
- Versioned fee and attendance rules. Existing charges retain their original rule reference.
- Reviewed student transfers retaining the identity, earlier charges and historical financial access for the former campus.
- In-app announcements, audience restrictions and acknowledgements.
- CSV import preview, same-file duplicates, exact identity linking, manually reviewed name/DOB candidates, source provenance and repeat-batch protection.
- Consolidated financial/occupancy/attendance reports, authorized report CSV exports and significant-action audit records.
- System-admin account activation/deactivation. Live account/role provisioning through an explicit administrator CLI.

## Architecture and persistence

```
Browser (React/Vite) → Express authenticated API → domain authorization and validation
                                             → demo: private local JSON file
                                             → Supabase: protected JSONB workspace + private Storage
```

Supabase Auth, profiles and scoped role assignments use your existing relational foundation. The operational prototype uses a revision-controlled JSONB document in cu_workspace; it is NOT a fully normalized 14,000-student ERP. Normal clients cannot access that table. Express filters every response; only its backend secret key can persist changes. A compare-and-swap SQL function protects concurrent writes. A database trigger preserves issued payments and audit entries. See docs/ARCHITECTURE.md.

## Switch to Supabase

Your existing migrations 001–003 are retained. Migration 004 is not required by this version. Run `database/005_workspace.sql`, configure `server/.env` using `.env.example`, then restart. Details: docs/SUPABASE.md.

**No Supabase credentials are bundled. Live Supabase login/storage integration has not been verified against your project.**

## Commands

- `npm run setup`: installs exact locked dependencies in client and server.
- `npm run dev`: starts both services.
- `npm test`: meaningful domain/API tests, including negative permissions and persistence.
- `npm run build`: creates client/dist.

For a local test of the production client bundle, serve client/dist through a server that proxies /api to Express; `vite preview` alone is not a configured production API host.

## Submission and scope

Read docs/DEMO_SCRIPT.md, docs/FEATURE_STATUS.md and docs/VALIDATION.md before presenting. The event rules supplied require honest disclosure of AI assistance and reused components. DEVELOPMENT_NOTES.md records that assistance; adapt the disclosure to the organizers' policy.

Excluded: LMS, examination evaluation, payroll, transport, recruitment ATS, biometric attendance, live payment gateways, government portal integrations and external SMS/email/WhatsApp delivery.
