# Honest feature status

| Area | Implemented | Remaining/limits |
|---|---|---|
| UI | Dashboard, role menus, search, campus filters, modal forms, responsive tables | No saved custom dashboard layouts |
| Auth | Demo opaque sessions; Supabase Auth verification adapter | Live project verification, invitations, MFA and recovery UI |
| Roles | Eleven roles; server action and field restrictions | Full browser role-grant/delegation editor; live grants use CLI |
| Staff | Profiles, appointments, HOD designation, linked teaching assignments, transfer/separation | Multiple concurrent employment appointments, HR/payroll excluded |
| Students | Register/confirm admission, profile correction, identity-preserving transfer | Full programme catalogue and arbitrary enrolment history editor |
| Documents | Private upload/download and reviewed verification | 500 KB cap; no malware scanning or real documents in demo |
| Guardians | Verified linked-child read model, role-safe portal | Sample has one child; no multi-child relationship editor |
| Fees | Campus tuition, hostel charges, concessions, partial payments, receipts, reviewed full reversals | No live gateway, partial refund/payout reconciliation, complex instalment scheduling or automated late-fee engine |
| Attendance | Sessions, marking, locks, correction approvals, thresholds, missing counts | Full timetable, leave workflow, biometric integration |
| Hostels | Inventory, allocation/check-out, occupancy, accommodation requests | No room-change wizard or arbitrary hostel assignment editor |
| Rules | Effective-date versions, original fee-rule references, concession-policy exception checks | No arbitrary expression/rule language, retroactive rule changes blocked |
| Scholarships | Application → approval → claim → received; receipt posting on money received | Application entry and sample schemes included; no government submission |
| Imports | CSV validation, exact links, reviewed candidates, fingerprints, provenance | No XLSX parser or destructive merge of two pre-existing operational identities; no supplied ground-truth benchmark |
| Reports | Authorized aggregate rows, CSV export, export audit entry | No PDF receipt/report generation or 14,000-record performance claims |
| Communication | In-app notices and acknowledgement | No external email, SMS or WhatsApp provider |
| Persistence | Atomic local file; protected Supabase JSONB + CAS and immutable-history trigger | Full normalized relational domain schema and backup/recovery automation |
| Audit | Significant operational actions and decisions | Not all passive reads logged; no external immutable audit service |
| Deployment | Local React + Express scripts and production frontend build | Public hosting and production hardening not performed |

No LMS, examination evaluation, transport, payroll, recruitment ATS or unrelated AI features are included.
