# Validation record

## Executed locally

- Frontend production build: passed (Vite 8.3.5). A bundle-size advisory remains; it is not a build failure.
- Node domain/API test suite: 27 tests passed, zero failed.
- Browser navigation: trust overview and Students, Staff, Finance, Attendance, Hostels, Scholarships, Approvals, Rules, Imports, Reports, Notices and Audit loaded without page JavaScript errors.
- Browser submissions: registered and confirmed an admission; recorded a payment; created a staff appointment; reviewed and committed an ambiguous duplicate import; uploaded a private synthetic PDF as a parent.
- Browser stakeholder checks: all 11 role login flows exercised. Parent scope returned one student; faculty responses omitted finance and private fields; system admin responses omitted student/fee data.
- Mobile viewport: 390px layout checked; no document-level horizontal overflow. Data tables use internal horizontal scrolling.
- SQL: migrations 001–003 plus 005 executed in a local PGlite PostgreSQL-compatible runtime using stub Auth/Storage schemas and roles. Verified CAS save, stale-revision denial, immutable receipt guard, and denial of authenticated-client direct workspace reads.

## Test coverage

Seed identity counts; trust/campus isolation; department/class restrictions; student/parent relationships; field minimization; disallowed writes; cross-campus payment denial; unique payment references; overpayment rejection; separate reversal approver; original receipt preservation; self-approval denial; locked attendance; attendance upsert; bed conflict and hostel scope; rule-history preservation; repeated imports; ambiguous-match review; source-resolution provenance; staff separation; pending scholarship handling; identity-preserving transfers; former-campus financial summaries; consolidated financial reconciliation; HTTP authentication and logout; serialized concurrent writes and persistence; private document denial and account deactivation.

Run with `npm test` from the project root.

## Not verified

Live Supabase Auth, Storage and production network integration against your project; production hosting; 14,000-student scale; organizer ground-truth deduplication accuracy; legal/privacy compliance certification; external delivery services. Local SQL execution does not prove the live project's configuration is correct.

The browser validation tools were temporary development dependencies outside the project. The shipped test suite uses Node's built-in test runner and needs no browser installation.
