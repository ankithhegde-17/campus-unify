# Role and field boundaries

Permissions are checked in server/src/domain/access.js and domain/actions.js. The Supabase workspace has no ordinary-client policies: it is accessed through the trusted backend.

| Role | Fetch/view | Change/approve | Hidden by default |
|---|---|---|---|
| Trust Management | All campus operational records, staff/stakeholder directory, reports, audit | Appointments, rules, payments, approved requests, transfers | Secrets and authentication credentials |
| Campus Administrator | Own campus operations and staff | Own campus admissions, collections, local rules and independent reviews | Other campuses' personal records; cannot appoint/separate without trust |
| Admissions | Own campus admissions, verification documents, imports | Register/confirm admissions, exact import links, transfer/correction requests | Fees, detailed attendance, other-campus profiles |
| Accounts | Own campus fee statements, scholarship and financial reports | Collections, concession/refund requests, reimbursement stages | DOB, admission documents, academic attendance |
| HOD | Assigned department students, faculty and attendance | Assigned-department sessions, locks and linked teaching assignments | Finance, identity documents, other departments |
| Faculty | Assigned class roster and attendance | Assigned subject marking and correction requests | Fees, DOB, guardian contacts, other classes |
| Warden | Assigned sample hostel, resident/candidate basic contacts | Own assigned beds, allocations and check-out | Tuition ledger, academic attendance, other campuses |
| Student | Own profile, fees, attendance, accommodation, notices and documents | Requests, document upload, acknowledgements | Other students and staff-only decisions |
| Parent | Authorized verified child's permitted records | Requests, documents and acknowledgements | Other children, other guardians' private information |
| System Administrator | Account directory and audit | Enable/disable application access | Student academic, financial and document data |
| Auditor | Scoped read-only financial statements, aggregate reports and audit | Authorized report export only | Operational writes and private documents |

Sensitive details are removed from API JSON, not merely hidden in the interface. Faculty receive class identifiers but not student DOB/phone/guardian email. Wardens receive limited emergency/contact fields. Reports export only for roles assigned the report capability. Individual student/guardian receipt downloads are permitted within their own relationship.

Prior-campus financial summaries are retained after a student transfers, without exposing the destination campus's new personal/academic records. Staff transfer disables stale live campus scopes until the administrator reprovisions them. Historical academic reports across transfers remain a future extension.

The live account provisioning CLI is a trusted owner operation, and it can grant privileged access: keep backend secrets and CLI access restricted. It is not a public signup mechanism.
