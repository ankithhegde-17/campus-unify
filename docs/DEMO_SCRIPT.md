# Suggested 7-minute demonstration

All accounts use Demo@12345 in demo mode. Sign out to change stakeholder; there is no in-session privilege-switch control.

1. **Trust overview (45 seconds).** Sign in as trust_management@demo.local. Show six campuses, students, outstanding fees, occupancy and attendance risk. Filter to Campus A and back. Explain that 72 synthetic students illustrate a 14,000-student requirement; this is not a scale benchmark.
2. **Role boundaries (45 seconds).** Sign out and choose Faculty. Show the assigned class and lack of fees, other campuses and guardian details. Sign in as Parent and show only Ananya's records. Return to Trust Management.
3. **Fees (60 seconds).** Fees & receipts → record a small payment for a student with dues. Use a new reference such as JURY-DEMO-001. Show the immutable receipt and lower balance. Reusing the reference is rejected. Request a reversal, then use Campus Administrator for independent approval when it is a Campus A payment. A requester cannot approve their own request.
4. **Rules (45 seconds).** Campus rules → add a future/current version for Campus A. Existing charges remain unchanged. New admissions and hostel allocations use the applicable rule.
5. **Staff (45 seconds).** Appoint a fictional faculty member. Explain that employment and login grants are separate. Class assignments are available for already-linked faculty; separation disables linked access and preserves history. Do not separate the faculty sample until after showing the faculty portal.
6. **Hostel/attendance (45 seconds).** Show bed occupancy and available beds. Allocate a free bed to an unallocated active student. Show locked attendance and a correction request. Bed and student double allocation are rejected.
7. **Imports (60 seconds).** Select Campus A and Computer Science. The sample CSV contains new rows, ST1001 (exact existing identity) and ALT1001 (name/DOB candidate). Preview. Link the exact row. As Trust/Campus Admin, choose the reviewed candidate and supply a verification reason. Commit. Re-previewing the identical batch is flagged. No blind name-based merge occurs.
8. **Reports and traceability (45 seconds).** Export the consolidated report, show audit entries and the request queue. Mention in-app parent communications and private document verification.

## Answers for judges

**Forty spreadsheets?** Fragmented departmental/campus files, not a measured 40% duplication rate.

**One identity?** A trust-wide student ID persists across admissions/transfers; charges, payments and histories refer to it.

**How do you resolve duplicates?** Normalize formats, compare reliable IDs, present name/DOB candidates for explicit review, preserve source rows and resolutions, and block repeated batches. Organizer ground-truth evaluation remains pending because no organizer dataset was supplied.

**How are campus differences supported?** Effective-dated versions hold tuition, accommodation, concession-policy limits and attendance thresholds. Charges reference their applicable rule. Above-policy concessions require trust review; approved changes are recorded.

**Is this a relational ERP?** Auth and role scope use relational foundation tables. Operational persistence is a protected revisioned JSONB workspace for this hackathon prototype. Dedicated normalized domain tables and large-scale testing are future work.

**How is access enforced?** Express verifies identity, checks current account status, roles and scope on every action, filters records/fields, and protects the operational store from direct user access. Buttons are a convenience, not the security boundary.

**What is not integrated?** No real payment gateway, government scholarship portal, external messaging or production hosting. Compliance is not certified.
