import test from "node:test";
import assert from "node:assert/strict";
import { makeSeed } from "../src/domain/seed.js";
import { safeView } from "../src/domain/access.js";
import {
  act,
  balance,
  previewImport,
  onlinePaymentQuote,
  recordOnlinePayment,
} from "../src/domain/actions.js";
function actor(s, role) {
  const u = s.users.find((u) => u.role === role);
  return {
    userId: u.id,
    profile: { id: u.id, full_name: u.full_name },
    assignments: [
      {
        role_code: role,
        scope:
          role === "hod"
            ? "department"
            : ["student", "parent"].includes(role)
              ? "self"
              : u.campus_id
                ? "campus"
                : "trust",
        campus_id: u.campus_id,
        department_id: u.department_id,
      },
    ],
  };
}
const fresh = () => makeSeed();
test("seed has six campuses and 72 distinct identities", () => {
  const s = fresh();
  assert.equal(s.campuses.length, 6);
  assert.equal(s.students.length, 72);
  assert.equal(new Set(s.students.map((s) => s.id)).size, 72);
});
test("trust sees all campuses and students", () => {
  const s = fresh(),
    v = safeView(s, actor(s, "trust_management"));
  assert.equal(v.students.length, 72);
  assert.equal(v.staff.length, 18);
});
test("campus admin cannot read another campus", () => {
  const s = fresh(),
    a = actor(s, "campus_admin"),
    v = safeView(s, a);
  assert.equal(v.campuses.length, 1);
  assert(v.students.every((st) => st.campus_id === a.assignments[0].campus_id));
  assert.equal(v.students.length, 12);
});
test("faculty sees assigned class, no finance or private guardian fields", () => {
  const s = fresh(),
    v = safeView(s, actor(s, "faculty"));
  assert.equal(v.students.length, 6);
  assert.equal(v.payments.length, 0);
  assert.equal(v.charges.length, 0);
  assert(
    v.students.every(
      (st) => !("dob" in st) && !("phone" in st) && !("guardian_email" in st),
    ),
  );
});
test("HOD can read only assigned department staff and students", () => {
  const s = fresh(),
    a = actor(s, "hod"),
    v = safeView(s, a);
  assert(
    v.students.every(
      (st) => st.department_id === a.assignments[0].department_id,
    ),
  );
  assert(
    v.staff.every((st) => st.department_id === a.assignments[0].department_id),
  );
});
test("parent and student see only linked child identity", () => {
  const s = fresh();
  for (const role of ["parent", "student"]) {
    const v = safeView(s, actor(s, role));
    assert.equal(v.students.length, 1);
    assert.equal(v.students[0].id, s.students[0].id);
    assert(v.payments.every((p) => p.student_id === s.students[0].id));
  }
});
test("system admin does not receive academic/financial records", () => {
  const s = fresh(),
    v = safeView(s, actor(s, "system_admin"));
  assert.equal(v.students.length, 0);
  assert.equal(v.charges.length, 0);
  assert.equal(v.staff.length, 0);
  assert(v.users.length > 0);
});
test("faculty cannot record a payment", () => {
  const s = fresh();
  assert.throws(
    () =>
      act(s, actor(s, "faculty"), "payment.record", {
        student_id: s.students[0].id,
        amount: 10,
        reference: "ATTACK",
      }),
    /permission/,
  );
});
test("cross-campus payment request is denied", () => {
  const s = fresh();
  assert.throws(
    () =>
      act(s, actor(s, "accounts_officer"), "payment.record", {
        student_id: s.students[12].id,
        amount: 10,
        reference: "ATTACK",
      }),
    (e) => e.status === 403,
  );
});
test("payment creates immutable receipt and rejects duplicate/overpayment", () => {
  const s = fresh(),
    a = actor(s, "accounts_officer"),
    student = s.students[0],
    before = balance(s, student.id);
  const out = act(s, a, "payment.record", {
    student_id: student.id,
    amount: 1000,
    reference: "TEST-UNIQUE",
  });
  assert.equal(balance(s, student.id), before - 1000);
  assert(out.receipt.receipt_no);
  assert.throws(
    () =>
      act(s, a, "payment.record", {
        student_id: student.id,
        amount: 1000,
        reference: "TEST-UNIQUE",
      }),
    /already/,
  );
  assert.throws(
    () =>
      act(s, a, "payment.record", {
        student_id: student.id,
        amount: 10000000,
        reference: "TOO-MUCH",
      }),
    /exceeds/,
  );
});
test("reversal requires separate approver and preserves original", () => {
  const s = fresh(),
    accounts = actor(s, "accounts_officer"),
    trust = actor(s, "trust_management"),
    p = s.payments[0],
    copy = structuredClone(p);
  act(s, accounts, "request.create", {
    type: "refund",
    student_id: p.student_id,
    payment_id: p.id,
    details: "Incorrect collection",
  });
  const request = s.requests.at(-1);
  assert.throws(
    () =>
      act(s, accounts, "request.decide", {
        request_id: request.id,
        decision: "approved",
        reason: "test",
      }),
    /permission/,
  );
  act(s, trust, "request.decide", {
    request_id: request.id,
    decision: "approved",
    reason: "Verified duplicate collection",
  });
  assert.deepEqual(p, copy);
  assert.equal(s.payments.at(-1).amount, -p.amount);
  assert.equal(s.payments.at(-1).original_payment_id, p.id);
  assert.throws(
    () =>
      act(s, trust, "request.decide", {
        request_id: request.id,
        decision: "approved",
        reason: "again",
      }),
    /already/,
  );
});
test("trust cannot approve own request", () => {
  const s = fresh(),
    a = actor(s, "trust_management");
  act(s, a, "request.create", {
    student_id: s.students[0].id,
    type: "profile_correction",
    field: "full_name",
    new_value: "Verified Name",
    details: "Evidence checked",
  });
  assert.throws(
    () =>
      act(s, a, "request.decide", {
        request_id: s.requests.at(-1).id,
        decision: "approved",
        reason: "self",
      }),
    /own request/,
  );
});
test("locked attendance cannot be overwritten directly", () => {
  const s = fresh(),
    a = actor(s, "trust_management");
  assert.throws(
    () =>
      act(s, a, "attendance.mark", {
        session_id: s.sessions[0].id,
        student_id: s.students[0].id,
        status: "present",
      }),
    /locked/,
  );
});
test("attendance upsert preserves one entry per student/session", () => {
  const s = fresh(),
    a = actor(s, "faculty"),
    session = s.sessions.find(
      (x) => x.campus_id === s.campuses[0].id && !x.locked,
    ),
    before = s.attendance.length;
  act(s, a, "attendance.mark", {
    session_id: session.id,
    student_id: s.students[0].id,
    status: "present",
  });
  act(s, a, "attendance.mark", {
    session_id: session.id,
    student_id: s.students[0].id,
    status: "absent",
  });
  assert.equal(s.attendance.length, before);
});
test("hostel double allocation is rejected", () => {
  const s = fresh();
  assert.throws(
    () =>
      act(s, actor(s, "trust_management"), "hostel.allocate", {
        student_id: s.students[8].id,
        bed_id: s.beds[0].id,
      }),
    /already/,
  );
});
test("warden cannot allocate a bed outside assigned campus", () => {
  const s = fresh();
  assert.throws(
    () =>
      act(s, actor(s, "warden"), "hostel.allocate", {
        student_id: s.students[20].id,
        bed_id: s.beds[20].id,
      }),
    /outside/,
  );
});
test("rule update preserves existing fee charges", () => {
  const s = fresh(),
    copy = structuredClone(s.charges);
  act(s, actor(s, "campus_admin"), "rule.create", {
    campus_id: s.campuses[0].id,
    effective_from: new Date().toISOString().slice(0, 10),
    tuition: 92000,
    hostel: 26000,
    attendance_threshold: 80,
    concession_percent: 15,
  });
  assert.deepEqual(s.charges, copy);
  assert.equal(s.rules.at(-1).version, 2);
});
test("import detects batch and same-file duplicates", () => {
  const s = fresh(),
    a = actor(s, "admissions_officer"),
    b = {
      campus_id: s.campuses[0].id,
      department_id: s.departments[0].id,
      rows: [
        { student_code: "NEW-1", full_name: "New Demo", dob: "2007-01-01" },
      ],
    };
  const preview = previewImport(s, a, b);
  assert.equal(preview.rows[0].status, "new");
  act(s, a, "import.commit", { ...b, decisions: { 0: "new" } });
  assert.throws(
    () => act(s, a, "import.commit", { ...b, decisions: { 0: "new" } }),
    /already/,
  );
  assert(
    previewImport(s, a, { ...b, rows: [b.rows[0], b.rows[0]] }).rows[1].errors
      .length > 0,
  );
});
test("ambiguous name/DOB cannot be automatically merged or created", () => {
  const s = fresh(),
    a = actor(s, "admissions_officer"),
    old = s.students[0],
    b = {
      campus_id: old.campus_id,
      department_id: old.department_id,
      rows: [
        { student_code: "DIFFERENT", full_name: old.full_name, dob: old.dob },
      ],
    };
  assert.equal(previewImport(s, a, b).rows[0].status, "review");
  assert.throws(
    () => act(s, a, "import.commit", { ...b, decisions: { 0: "new" } }),
    /duplicates/,
  );
});
test("staff separation preserves record and disables linked access", () => {
  const s = fresh(),
    u = s.users.find((u) => u.role === "faculty");
  act(s, actor(s, "trust_management"), "staff.separate", {
    staff_id: u.staff_id,
    reason: "Appointment ended",
  });
  assert.equal(s.staff.find((st) => st.id === u.staff_id).status, "inactive");
  assert.equal(u.is_active, false);
});
test("pending scholarship does not reduce outstanding balance", () => {
  const s = fresh(),
    a = actor(s, "accounts_officer"),
    sh = s.scholarships[0],
    before = balance(s, sh.student_id);
  act(s, a, "scholarship.update", {
    scholarship_id: sh.id,
    status: "approved",
  });
  assert.equal(balance(s, sh.student_id), before);
});
test("student transfer preserves identity and historical charges", () => {
  const s = fresh(),
    a = actor(s, "admissions_officer"),
    t = actor(s, "trust_management"),
    st = s.students[0],
    old = st.id,
    charges = structuredClone(s.charges);
  act(s, a, "request.create", {
    student_id: st.id,
    type: "transfer",
    to_campus_id: s.campuses[1].id,
    department_id: s.departments[2].id,
    class_name: "Year 1 · A",
    details: "Approved relocation",
  });
  act(s, t, "request.decide", {
    request_id: s.requests.at(-1).id,
    decision: "approved",
    reason: "Both institutions confirmed",
  });
  assert.equal(st.id, old);
  assert.equal(st.campus_id, s.campuses[1].id);
  assert.deepEqual(s.charges, charges);
});
test("reviewed duplicate link preserves source mapping without new identity", () => {
  const s = fresh(),
    a = actor(s, "campus_admin"),
    old = s.students[0],
    count = s.students.length;
  const b = {
    campus_id: old.campus_id,
    department_id: old.department_id,
    rows: [
      { student_code: "ALTERNATE-001", full_name: old.full_name, dob: old.dob },
    ],
    decisions: { 0: `link:${old.id}` },
    review_reason: "Matched admission evidence and guardian verification",
  };
  act(s, a, "import.commit", b);
  assert.equal(s.students.length, count);
  assert.equal(s.imports.at(-1).resolutions[0].student_id, old.id);
  assert.equal(s.imports.at(-1).resolutions[0].mode, "reviewed");
});
test("former campus retains only a financial summary after transfer", () => {
  const s = fresh(),
    admin = actor(s, "campus_admin"),
    admissions = actor(s, "admissions_officer"),
    trust = actor(s, "trust_management"),
    st = s.students[0];
  act(s, admissions, "request.create", {
    student_id: st.id,
    type: "transfer",
    to_campus_id: s.campuses[1].id,
    department_id: s.departments[2].id,
    class_name: "Year 1 · A",
    details: "Relocation",
  });
  act(s, trust, "request.decide", {
    request_id: s.requests.at(-1).id,
    decision: "approved",
    reason: "Verified",
  });
  const view = safeView(s, admin),
    historic = view.students.find((x) => x.id === st.id);
  assert.equal(historic.status, "transferred");
  assert(!("dob" in historic));
  assert(view.charges.some((ch) => ch.student_id === st.id));
  assert(!view.attendance.some((a) => a.student_id === st.id));
});
test("campus financial reports reconcile with trust aggregate", () => {
  const s = fresh(),
    trust = safeView(s, actor(s, "trust_management"));
  assert.equal(
    trust.report_rows.reduce((n, r) => n + r.outstanding, 0),
    s.students.reduce((n, st) => n + balance(s, st.id), 0),
  );
});
test("online payment: students pay only their own fees; staff by campus", () => {
  const s = fresh(),
    me = actor(s, "student"),
    own = s.users.find((u) => u.role === "student").student_id,
    other = s.students.find((x) => x.id !== own && balance(s, x.id) > 0);
  assert.equal(onlinePaymentQuote(s, me, { student_id: own, amount: 100 }).amount, 100);
  assert.throws(
    () => onlinePaymentQuote(s, me, { student_id: other.id, amount: 100 }),
    /permitted records/,
  );
  assert.throws(
    () => onlinePaymentQuote(s, actor(s, "faculty"), { student_id: own, amount: 100 }),
    /permission|permitted/,
  );
  assert.throws(
    () => onlinePaymentQuote(s, me, { student_id: own, amount: balance(s, own) + 1 }),
    /exceeds/,
  );
});
test("verified online payment issues one receipt per Razorpay payment id", () => {
  const s = fresh(),
    me = actor(s, "student"),
    own = s.users.find((u) => u.role === "student").student_id,
    before = balance(s, own),
    body = { student_id: own, amount: 250, reference: "pay_TEST123", order_id: "order_TEST" };
  const first = recordOnlinePayment(s, me, body);
  assert.equal(first.receipt.method, "Razorpay");
  assert.equal(balance(s, own), before - 250);
  const again = recordOnlinePayment(s, me, body);
  assert.equal(again.receipt.id, first.receipt.id);
  assert.equal(s.payments.filter((p) => p.reference === "pay_TEST123").length, 1);
  assert.ok(s.audit.some((a) => a.action === "payment.online"));
});
