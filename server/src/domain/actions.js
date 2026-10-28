import { randomUUID, createHash } from "node:crypto";
import {
  fail,
  requireRole,
  trust,
  campusAccess,
  studentAllowed,
  hasRole,
} from "./access.js";

const id = () => randomUUID(),
  today = () => new Date().toISOString().slice(0, 10);
const text = (v, name, max = 200) => {
  if (typeof v !== "string" || !v.trim() || v.trim().length > max)
    fail(`${name} is required (maximum ${max} characters).`);
  return v.trim();
};
const money = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0 || n > 10000000)
    fail("Enter a valid positive amount.");
  return Math.round(n * 100) / 100;
};
const date = (v) => {
  if (
    typeof v !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
    !Number.isFinite(Date.parse(v)) ||
    new Date(v).toISOString().slice(0, 10) !== v
  )
    fail("Enter a valid date.");
  return v;
};
const find = (arr, key, label) =>
  arr.find((x) => x.id === key) || fail(`${label} not found.`, 404);
function student(state, actor, key) {
  const s = find(state.students, key, "Student");
  if (!studentAllowed(state, actor, s))
    fail("Student is outside your permitted records.", 403);
  return s;
}
function dept(state, campusId, deptId) {
  if (
    !state.departments.some(
      (d) => d.id === deptId && d.campus_id === campusId && d.is_active,
    )
  )
    fail("Select an active department in this campus.");
}
export function currentRule(state, campusId, asOf = today()) {
  return (
    state.rules
      .filter((r) => r.campus_id === campusId && r.effective_from <= asOf)
      .sort(
        (a, b) =>
          b.effective_from.localeCompare(a.effective_from) ||
          b.version - a.version,
      )[0] || fail("No fee rule is effective for this campus and date.")
  );
}
function chargePaid(state, chargeId) {
  return state.payments.reduce(
    (total, p) =>
      total +
      (p.allocations
        ?.filter((a) => a.charge_id === chargeId)
        .reduce((n, a) => n + a.amount, 0) ??
        (p.charge_id === chargeId ? p.amount : 0)),
    0,
  );
}
function allocatePayment(state, studentId, campusId, amount) {
  let remaining = amount;
  const allocations = [];
  for (const ch of state.charges.filter(
    (c) => c.student_id === studentId && c.campus_id === campusId,
  )) {
    const open = ch.amount - ch.concession - chargePaid(state, ch.id),
      part = Math.min(Math.max(0, open), remaining);
    if (part > 0) {
      allocations.push({ charge_id: ch.id, amount: part });
      remaining = Math.round((remaining - part) * 100) / 100;
    }
  }
  if (remaining > 0)
    fail("Amount exceeds outstanding charges for this campus.");
  return allocations;
}
export function balance(state, studentId) {
  const due = state.charges
    .filter((c) => c.student_id === studentId)
    .reduce((n, c) => n + c.amount - c.concession, 0);
  const paid = state.payments
    .filter((p) => p.student_id === studentId)
    .reduce((n, p) => n + p.amount, 0);
  return Math.round((due - paid) * 100) / 100;
}
export function previewImport(state, actor, b) {
  requireRole(
    actor,
    ["trust_management", "campus_admin", "admissions_officer"],
    b.campus_id,
  );
  if (!Array.isArray(b.rows) || !b.rows.length || b.rows.length > 500)
    fail("Import 1–500 rows per batch.");
  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ campus: b.campus_id, rows: b.rows }))
    .digest("hex");
  const duplicateBatch = state.imports.some(
    (i) => i.fingerprint === fingerprint,
  );
  const seen = new Set();
  const rows = b.rows.map((row, index) => {
    const errors = [];
    const name =
      typeof row.full_name === "string"
        ? row.full_name.trim().replace(/\s+/g, " ")
        : "";
    const code = String(row.student_code || "")
      .trim()
      .toUpperCase();
    if (!name) errors.push("Missing full_name");
    if (!code) errors.push("Missing student_code");
    if (seen.has(code)) errors.push("Repeated student_code in this file");
    seen.add(code);
    if (row.dob && !/^\d{4}-\d{2}-\d{2}$/.test(row.dob))
      errors.push("DOB must use YYYY-MM-DD");
    const exact = state.students.find(
      (s) => s.student_code.toUpperCase() === code,
    );
    const candidates = state.students
      .filter(
        (s) =>
          s.campus_id === b.campus_id &&
          s.full_name.toLowerCase() === name.toLowerCase() &&
          s.dob === row.dob,
      )
      .map((s) => ({
        id: s.id,
        full_name: s.full_name,
        student_code: s.student_code,
      }));
    return {
      index,
      row: { ...row, full_name: name, student_code: code },
      errors,
      match: exact
        ? {
            student_code: exact.student_code,
            id: exact.campus_id === b.campus_id ? exact.id : null,
            review_required: exact.campus_id !== b.campus_id,
          }
        : null,
      candidates,
      status: errors.length
        ? "invalid"
        : exact
          ? "existing"
          : candidates.length
            ? "review"
            : "new",
    };
  });
  return { fingerprint, duplicateBatch, rows };
}
export function act(state, actor, action, b = {}) {
  let result = { message: "Saved successfully." },
    campusId = b.campus_id;
  switch (action) {
    case "report.export": {
      requireRole(actor, [
        "trust_management",
        "campus_admin",
        "accounts_officer",
        "auditor",
      ]);
      result.message = "Authorized report export recorded.";
      break;
    }
    case "document.verify": {
      const doc = find(state.documents || [], b.document_id, "Document");
      const s = student(state, actor, doc.student_id);
      campusId = s.campus_id;
      requireRole(
        actor,
        ["trust_management", "campus_admin", "admissions_officer"],
        campusId,
      );
      if (!["verified", "rejected"].includes(b.status))
        fail("Invalid verification status.");
      text(b.reason, "Verification reason");
      Object.assign(doc, {
        status: b.status,
        verified_by: actor.userId,
        verification_reason: b.reason,
      });
      break;
    }
    case "notice.acknowledge": {
      const n = find(state.notices, b.notice_id, "Notice");
      if (n.campus_id && !campusAccess(actor, n.campus_id)) {
        if (
          !state.students.some(
            (s) =>
              s.campus_id === n.campus_id && studentAllowed(state, actor, s),
          )
        )
          fail("Notice is outside your scope.", 403);
      }
      if (n.audience !== "all" && !hasRole(actor, n.audience) && !trust(actor))
        fail("Notice is outside your audience.", 403);
      state.acknowledgements ||= [];
      if (
        !state.acknowledgements.some(
          (a) => a.notice_id === n.id && a.user_id === actor.userId,
        )
      )
        state.acknowledgements.push({
          id: id(),
          notice_id: n.id,
          user_id: actor.userId,
          at: new Date().toISOString(),
        });
      result.message = "Announcement acknowledged.";
      break;
    }
    case "session.lock": {
      const session = find(state.sessions, b.session_id, "Session");
      campusId = session.campus_id;
      requireRole(actor, ["trust_management", "campus_admin", "hod"], campusId);
      if (
        hasRole(actor, "hod") &&
        !hasRole(actor, "trust_management", "campus_admin") &&
        !actor.assignments.some(
          (a) => a.department_id === session.department_id,
        )
      )
        fail("Session is outside your department.", 403);
      session.locked = true;
      result.message = "Session locked. Future corrections require approval.";
      break;
    }
    case "student.create": {
      requireRole(
        actor,
        ["trust_management", "campus_admin", "admissions_officer"],
        b.campus_id,
      );
      dept(state, b.campus_id, b.department_id);
      const code = text(b.student_code, "Student code", 30).toUpperCase();
      if (state.students.some((s) => s.student_code === code))
        fail("Student code already exists. Review the existing identity.", 409);
      const s = {
        id: id(),
        student_code: code,
        full_name: text(b.full_name, "Student name"),
        dob: date(b.dob),
        campus_id: b.campus_id,
        department_id: b.department_id,
        class_name: text(b.class_name, "Class"),
        email: text(b.email, "Email"),
        guardian_name: text(b.guardian_name, "Guardian name"),
        guardian_email: text(b.guardian_email, "Guardian email"),
        phone: text(b.phone, "Contact number", 30),
        status: "pending",
        admitted_on: today(),
        academic_year: "2026–27",
      };
      state.students.push(s);
      result = { message: "Admission registered for verification.", id: s.id };
      break;
    }
    case "student.admit": {
      const s = student(state, actor, b.student_id);
      campusId = s.campus_id;
      requireRole(
        actor,
        ["trust_management", "campus_admin", "admissions_officer"],
        campusId,
      );
      if (s.status !== "pending") fail("Admission is already processed.");
      const rule = currentRule(state, campusId);
      s.status = "active";
      state.charges.push({
        id: id(),
        student_id: s.id,
        campus_id: campusId,
        head: "Annual tuition",
        amount: rule.tuition,
        concession: 0,
        due_date: today(),
        rule_id: rule.id,
        academic_year: s.academic_year,
      });
      result.message = "Admission confirmed and tuition charge created.";
      break;
    }
    case "teaching.assign": {
      requireRole(
        actor,
        ["trust_management", "campus_admin", "hod"],
        b.campus_id,
      );
      dept(state, b.campus_id, b.department_id);
      if (
        hasRole(actor, "hod") &&
        !hasRole(actor, "trust_management", "campus_admin") &&
        !actor.assignments.some((a) => a.department_id === b.department_id)
      )
        fail("Department is outside your scope.", 403);
      const u = find(state.users, b.user_id, "Faculty account");
      const staff = state.staff.find(
        (s) => s.id === u.staff_id && s.status === "active",
      );
      if (
        !u.is_active ||
        u.role !== "faculty" ||
        !staff ||
        staff.campus_id !== b.campus_id ||
        staff.department_id !== b.department_id
      )
        fail(
          "Faculty must have an active linked appointment in this department.",
        );
      const className = text(b.class_name, "Class"),
        subject = text(b.subject, "Subject");
      if (
        state.teaching.some(
          (t) =>
            t.user_id === u.id &&
            t.class_name === className &&
            t.subject === subject &&
            t.department_id === b.department_id,
        )
      )
        fail("Teaching assignment already exists.", 409);
      state.teaching.push({
        id: id(),
        user_id: u.id,
        campus_id: b.campus_id,
        department_id: b.department_id,
        class_name: className,
        subject,
      });
      result.message = "Teaching assignment saved.";
      break;
    }
    case "staff.appoint": {
      requireRole(actor, ["trust_management"], b.campus_id);
      dept(state, b.campus_id, b.department_id);
      const code = text(b.staff_code, "Staff code", 30).toUpperCase();
      if (state.staff.some((s) => s.staff_code === code))
        fail("Staff code already exists.", 409);
      const s = {
        id: id(),
        staff_code: code,
        full_name: text(b.full_name, "Name"),
        email: text(b.email, "Official email"),
        phone: text(b.phone, "Phone", 30),
        qualification: text(b.qualification, "Qualification"),
        designation: text(b.designation, "Designation"),
        campus_id: b.campus_id,
        department_id: b.department_id,
        started_on: date(b.started_on || today()),
        ended_on: null,
        status: "active",
      };
      state.staff.push(s);
      result = {
        message:
          "Staff appointment recorded. Portal account access is managed separately.",
        id: s.id,
      };
      break;
    }
    case "staff.separate": {
      const s = find(state.staff, b.staff_id, "Staff");
      campusId = s.campus_id;
      requireRole(actor, ["trust_management"], campusId);
      if (s.status !== "active") fail("This appointment is already inactive.");
      text(b.reason, "Reason");
      s.status = "inactive";
      s.ended_on = today();
      s.separation_reason = b.reason;
      state.users
        .filter((u) => u.staff_id === s.id)
        .forEach((u) => (u.is_active = false));
      result.message =
        "Appointment ended. Linked portal access disabled; history preserved.";
      break;
    }
    case "staff.transfer": {
      const s = find(state.staff, b.staff_id, "Staff");
      requireRole(actor, ["trust_management"], s.campus_id);
      dept(state, b.campus_id, b.department_id);
      if (s.status !== "active" || s.campus_id === b.campus_id)
        fail("Choose a different campus for an active staff member.");
      text(b.reason, "Reason");
      const old = s.campus_id;
      state.transfers.push({
        id: id(),
        staff_id: s.id,
        from_campus_id: old,
        to_campus_id: b.campus_id,
        date: today(),
        reason: b.reason,
      });
      s.campus_id = b.campus_id;
      s.department_id = b.department_id;
      state.users
        .filter((u) => u.staff_id === s.id)
        .forEach((u) => {
          u.campus_id = b.campus_id;
          u.department_id = b.department_id;
        });
      state.teaching = state.teaching.filter(
        (t) =>
          !state.users.some((u) => u.staff_id === s.id && u.id === t.user_id),
      );
      result.message =
        "Staff transferred; former teaching assignments removed.";
      break;
    }
    case "payment.record": {
      const s = find(state.students, b.student_id, "Student");
      campusId = b.campus_id || s.campus_id;
      requireRole(
        actor,
        ["trust_management", "campus_admin", "accounts_officer"],
        campusId,
      );
      if (
        !state.charges.some(
          (c) => c.student_id === s.id && c.campus_id === campusId,
        )
      )
        fail("Student is outside your permitted financial records.", 403);
      const amount = money(b.amount),
        reference = text(b.reference, "Unique payment reference", 100);
      if (state.payments.some((p) => p.reference === reference))
        fail("This payment reference is already recorded.", 409);
      if (amount > balance(state, s.id))
        fail("Amount exceeds the current outstanding balance.");
      const allocations = allocatePayment(state, s.id, campusId, amount);
      const p = {
        id: id(),
        student_id: s.id,
        campus_id: campusId,
        amount,
        allocations,
        reference,
        receipt_no: `CU-${new Date().getFullYear()}-${String(state.payments.length + 1).padStart(6, "0")}`,
        method: ["Cash", "Bank transfer", "UPI"].includes(b.method)
          ? b.method
          : "Bank transfer",
        paid_at: today(),
        created_by: actor.userId,
        kind: "payment",
      };
      state.payments.push(p);
      result = {
        message: `Payment recorded. Receipt ${p.receipt_no}`,
        receipt: p,
      };
      break;
    }
    case "session.create": {
      requireRole(
        actor,
        ["trust_management", "campus_admin", "hod", "faculty"],
        b.campus_id,
      );
      dept(state, b.campus_id, b.department_id);
      const day = date(b.date),
        className = text(b.class_name, "Class"),
        subject = text(b.subject, "Subject");
      if (
        hasRole(actor, "faculty") &&
        !hasRole(actor, "trust_management", "campus_admin", "hod") &&
        !state.teaching.some(
          (t) =>
            t.user_id === actor.userId &&
            t.campus_id === b.campus_id &&
            t.department_id === b.department_id &&
            t.class_name === className &&
            t.subject === subject,
        )
      )
        fail("This teaching assignment is not yours.", 403);
      if (
        hasRole(actor, "hod") &&
        !hasRole(actor, "trust_management", "campus_admin") &&
        !actor.assignments.some((a) => a.department_id === b.department_id)
      )
        fail("Department is outside your scope.", 403);
      if (
        state.sessions.some(
          (s) =>
            s.campus_id === b.campus_id &&
            s.department_id === b.department_id &&
            s.class_name === className &&
            s.subject === subject &&
            s.date === day,
        )
      )
        fail("This class session already exists.", 409);
      state.sessions.push({
        id: id(),
        campus_id: b.campus_id,
        department_id: b.department_id,
        class_name: className,
        subject,
        date: day,
        locked: false,
      });
      break;
    }
    case "attendance.mark": {
      const session = find(state.sessions, b.session_id, "Session");
      campusId = session.campus_id;
      requireRole(
        actor,
        ["trust_management", "campus_admin", "hod", "faculty"],
        campusId,
      );
      if (session.locked)
        fail("Session is locked. Submit a correction request.");
      const s = student(state, actor, b.student_id);
      if (
        s.campus_id !== session.campus_id ||
        s.department_id !== session.department_id ||
        s.class_name !== session.class_name
      )
        fail("Student is not enrolled in this session.");
      if (
        hasRole(actor, "faculty") &&
        !hasRole(actor, "trust_management", "campus_admin", "hod") &&
        !state.teaching.some(
          (t) =>
            t.user_id === actor.userId &&
            t.campus_id === session.campus_id &&
            t.department_id === session.department_id &&
            t.class_name === session.class_name &&
            t.subject === session.subject,
        )
      )
        fail("Subject is outside your teaching assignment.", 403);
      if (!["present", "absent", "excused"].includes(b.status))
        fail("Invalid attendance status.");
      const old = state.attendance.find(
        (a) => a.student_id === s.id && a.session_id === session.id,
      );
      if (old)
        Object.assign(old, { status: b.status, marked_by: actor.userId });
      else
        state.attendance.push({
          id: id(),
          session_id: session.id,
          student_id: s.id,
          campus_id: campusId,
          status: b.status,
          marked_by: actor.userId,
        });
      break;
    }
    case "hostel.allocate": {
      const s = student(state, actor, b.student_id);
      campusId = s.campus_id;
      requireRole(
        actor,
        ["trust_management", "campus_admin", "warden"],
        campusId,
      );
      const bed = find(state.beds, b.bed_id, "Bed");
      if (
        hasRole(actor, "warden") &&
        !hasRole(actor, "trust_management", "campus_admin") &&
        bed.warden_user_id !== actor.userId
      )
        fail("Hostel is outside your assignment.", 403);
      if (bed.campus_id !== s.campus_id || !bed.available)
        fail("Select an available bed in the student campus.");
      if (
        state.allocations.some(
          (a) => !a.ends_on && (a.student_id === s.id || a.bed_id === bed.id),
        )
      )
        fail("Student or bed already has an active allocation.", 409);
      const allocationId = id();
      state.allocations.push({
        id: allocationId,
        student_id: s.id,
        campus_id: campusId,
        bed_id: bed.id,
        starts_on: today(),
        ends_on: null,
      });
      const rule = currentRule(state, campusId);
      state.charges.push({
        id: id(),
        student_id: s.id,
        campus_id: campusId,
        head: "Hostel accommodation",
        amount: rule.hostel,
        concession: 0,
        due_date: today(),
        rule_id: rule.id,
        allocation_id: allocationId,
        academic_year: s.academic_year,
      });
      result.message = "Bed allocated and hostel charge recorded.";
      break;
    }
    case "hostel.checkout": {
      const a = find(state.allocations, b.allocation_id, "Allocation");
      campusId = a.campus_id;
      requireRole(
        actor,
        ["trust_management", "campus_admin", "warden"],
        campusId,
      );
      if (
        hasRole(actor, "warden") &&
        !hasRole(actor, "trust_management", "campus_admin") &&
        !state.beds.some(
          (bed) => bed.id === a.bed_id && bed.warden_user_id === actor.userId,
        )
      )
        fail("Hostel is outside your assignment.", 403);
      if (a.ends_on) fail("Student is already checked out.");
      a.ends_on = today();
      break;
    }
    case "rule.create": {
      requireRole(actor, ["trust_management", "campus_admin"], b.campus_id);
      if (!state.campuses.some((c) => c.id === b.campus_id))
        fail("Campus not found.");
      const effective = date(b.effective_from);
      if (effective < today())
        fail(
          "Retrospective rules require a separate review; choose today or a future date.",
        );
      const threshold = Number(b.attendance_threshold),
        concession = Number(b.concession_percent);
      if (
        threshold < 1 ||
        threshold > 100 ||
        !Number.isFinite(threshold) ||
        !Number.isFinite(concession) ||
        concession < 0 ||
        concession > 100
      )
        fail("Invalid percentage.");
      state.rules.push({
        id: id(),
        campus_id: b.campus_id,
        version:
          Math.max(
            0,
            ...state.rules
              .filter((r) => r.campus_id === b.campus_id)
              .map((r) => r.version),
          ) + 1,
        effective_from: effective,
        tuition: money(b.tuition),
        hostel: money(b.hostel),
        attendance_threshold: threshold,
        concession_percent: concession,
        late_fee: 0,
        created_at: new Date().toISOString(),
      });
      result.message =
        "New rule version saved. Existing charges remain unchanged.";
      break;
    }
    case "request.create": {
      const s = student(state, actor, b.student_id);
      campusId = s.campus_id;
      const types = [
        "profile_correction",
        "attendance_correction",
        "concession",
        "refund",
        "transfer",
        "hostel_request",
      ];
      if (!types.includes(b.type)) fail("Invalid request type.");
      if (["refund", "concession"].includes(b.type))
        requireRole(
          actor,
          ["trust_management", "campus_admin", "accounts_officer"],
          campusId,
        );
      if (b.type === "transfer")
        requireRole(
          actor,
          ["trust_management", "campus_admin", "admissions_officer"],
          campusId,
        );
      const request = {
        id: id(),
        student_id: s.id,
        campus_id: campusId,
        type: b.type,
        details: text(b.details, "Request details", 2000),
        status: "pending",
        created_by: actor.userId,
        created_at: new Date().toISOString(),
      };
      if (b.type === "refund") {
        const p = find(state.payments, b.payment_id, "Payment");
        if (p.student_id !== s.id || p.kind !== "payment")
          fail("Select an original payment for this student.");
        if (state.payments.some((x) => x.original_payment_id === p.id))
          fail("This payment already has a reversal.");
        request.payment_id = p.id;
      }
      if (b.type === "concession") {
        request.amount = money(b.amount);
        request.charge_id = b.charge_id;
        const ch = find(state.charges, b.charge_id, "Charge");
        if (ch.student_id !== s.id) fail("Charge belongs to another student.");
      }
      if (b.type === "transfer") {
        dept(state, b.to_campus_id, b.department_id);
        if (b.to_campus_id === s.campus_id) fail("Select another campus.");
        Object.assign(request, {
          to_campus_id: b.to_campus_id,
          department_id: b.department_id,
          class_name: text(b.class_name, "Receiving class"),
        });
      }
      if (b.type === "attendance_correction") {
        const a = find(state.attendance, b.attendance_id, "Attendance");
        if (a.student_id !== s.id)
          fail("Attendance belongs to another student.");
        if (!["present", "absent", "excused"].includes(b.status))
          fail("Select a valid attendance status.");
        Object.assign(request, { attendance_id: a.id, new_status: b.status });
      }
      if (b.type === "profile_correction") {
        if (
          ![
            "full_name",
            "guardian_name",
            "email",
            "guardian_email",
            "phone",
          ].includes(b.field)
        )
          fail("Select a supported profile field.");
        request.field = b.field;
        request.new_value = text(b.new_value, "Corrected value");
      }
      state.requests.push(request);
      result.message = "Request submitted for independent review.";
      break;
    }
    case "request.decide": {
      const r = find(state.requests, b.request_id, "Request");
      campusId = r.campus_id;
      requireRole(actor, ["trust_management", "campus_admin"], campusId);
      if (r.status !== "pending")
        fail("Request has already been processed.", 409);
      if (r.created_by === actor.userId)
        fail("You cannot approve or reject your own request.", 403);
      text(b.reason, "Decision reason");
      if (!["approved", "rejected"].includes(b.decision))
        fail("Invalid decision.");
      if (b.decision === "approved") {
        if (r.type === "transfer") {
          requireRole(actor, ["trust_management"], r.campus_id);
          const s = find(state.students, r.student_id, "Student");
          state.transfers.push({
            id: id(),
            student_id: s.id,
            from_campus_id: s.campus_id,
            to_campus_id: r.to_campus_id,
            date: today(),
            old_department_id: s.department_id,
            old_class: s.class_name,
          });
          s.campus_id = r.to_campus_id;
          s.department_id = r.department_id;
          s.class_name = r.class_name;
          state.allocations
            .filter((a) => a.student_id === s.id && !a.ends_on)
            .forEach((a) => (a.ends_on = today()));
        }
        if (r.type === "refund") {
          const p = find(state.payments, r.payment_id, "Payment");
          if (state.payments.some((x) => x.original_payment_id === p.id))
            fail("Payment already reversed.", 409);
          state.payments.push({
            id: id(),
            student_id: p.student_id,
            campus_id: p.campus_id,
            amount: -p.amount,
            reference: `REV-${p.reference}`,
            receipt_no: `REV-${p.receipt_no}`,
            method: p.method,
            paid_at: today(),
            created_by: actor.userId,
            kind: "reversal",
            original_payment_id: p.id,
            charge_id: p.charge_id,
            allocations: p.allocations?.map((a) => ({
              ...a,
              amount: -a.amount,
            })),
            reason: b.reason,
          });
        }
        if (r.type === "concession") {
          const ch = find(state.charges, r.charge_id, "Charge");
          if (ch.concession + r.amount > ch.amount)
            fail("Concession exceeds this charge.");
          const rule = state.rules.find((rule) => rule.id === ch.rule_id);
          if (
            !trust(actor) &&
            rule &&
            ch.concession + r.amount >
              (ch.amount * rule.concession_percent) / 100
          )
            fail(
              "Concession exceeds the campus policy. Trust Management review is required.",
              403,
            );
          if (balance(state, ch.student_id) < r.amount)
            fail(
              "Concession would create a credit balance; review collected fees first.",
            );
          ch.concession += r.amount;
        }
        if (r.type === "attendance_correction") {
          const a = find(state.attendance, r.attendance_id, "Attendance");
          a.status = r.new_status;
          a.corrected_by = actor.userId;
        }
        if (r.type === "profile_correction")
          find(state.students, r.student_id, "Student")[r.field] = r.new_value;
      }
      Object.assign(r, {
        status: b.decision,
        decided_by: actor.userId,
        decision_reason: b.reason,
        decided_at: new Date().toISOString(),
      });
      result.message = `Request ${b.decision}.`;
      break;
    }
    case "notice.create": {
      requireRole(
        actor,
        ["trust_management", "campus_admin"],
        b.campus_id || undefined,
      );
      if (!b.campus_id && !trust(actor))
        fail("Only Trust Management may publish trust-wide notices.", 403);
      if (
        !["all", "student", "parent", "faculty", "warden"].includes(b.audience)
      )
        fail("Invalid audience.");
      state.notices.push({
        id: id(),
        campus_id: b.campus_id || null,
        title: text(b.title, "Title"),
        body: text(b.body, "Message", 3000),
        audience: b.audience,
        created_by: actor.userId,
        created_at: new Date().toISOString(),
      });
      break;
    }
    case "scholarship.create": {
      const s = student(state, actor, b.student_id);
      campusId = s.campus_id;
      requireRole(actor, [
        "trust_management",
        "campus_admin",
        "accounts_officer",
        "student",
        "parent",
      ]);
      const scheme = text(b.scheme, "Scheme");
      if (
        state.scholarships.some(
          (sh) =>
            sh.student_id === s.id &&
            sh.scheme.toLowerCase() === scheme.toLowerCase(),
        )
      )
        fail("An application for this scheme already exists.", 409);
      state.scholarships.push({
        id: id(),
        student_id: s.id,
        campus_id: campusId,
        scheme,
        amount: money(b.amount),
        status: "application",
        reference: "",
        received: 0,
        created_by: actor.userId,
      });
      result.message =
        "Scholarship application recorded; no payment has been posted.";
      break;
    }
    case "scholarship.update": {
      const sh = find(state.scholarships, b.scholarship_id, "Scholarship");
      campusId = sh.campus_id;
      requireRole(
        actor,
        ["trust_management", "campus_admin", "accounts_officer"],
        campusId,
      );
      const flow = {
        application: "approved",
        approved: "claimed",
        claimed: "received",
      };
      if (flow[sh.status] !== b.status)
        fail("Follow application → approved → claimed → received.");
      if (b.status === "received") {
        const reference = text(b.reference, "Reimbursement reference");
        if (state.payments.some((p) => p.reference === reference))
          fail("Reference already recorded.", 409);
        if (sh.amount > balance(state, sh.student_id))
          fail(
            "Reimbursement exceeds outstanding balance; reconcile before posting.",
          );
        sh.received = sh.amount;
        sh.reference = reference;
        state.payments.push({
          id: id(),
          student_id: sh.student_id,
          campus_id: sh.campus_id,
          amount: sh.amount,
          allocations: allocatePayment(
            state,
            sh.student_id,
            sh.campus_id,
            sh.amount,
          ),
          reference,
          receipt_no: `SCH-${state.payments.length + 1}`,
          method: "Scholarship reimbursement",
          paid_at: today(),
          kind: "payment",
          created_by: actor.userId,
        });
      }
      sh.status = b.status;
      break;
    }
    case "import.commit": {
      const preview = previewImport(state, actor, b);
      if (preview.duplicateBatch)
        fail("This exact batch has already been imported.", 409);
      dept(state, b.campus_id, b.department_id);
      let added = 0,
        linked = 0,
        skipped = 0;
      const resolutions = [];
      for (const row of preview.rows) {
        const decision = b.decisions?.[row.index] || "skip";
        if (decision === "skip") {
          skipped++;
          continue;
        }
        if (row.errors.length) fail(`Row ${row.index + 1} has errors.`);
        if (decision === "link") {
          if (!row.match?.id)
            fail(
              "Only an exact in-campus identity can be linked without manual review.",
            );
          resolutions.push({
            row: row.index,
            student_id: row.match.id,
            mode: "exact",
          });
          linked++;
          continue;
        }
        if (decision.startsWith("link:")) {
          requireRole(actor, ["trust_management", "campus_admin"], b.campus_id);
          const target = decision.slice(5);
          if (!row.candidates.some((c) => c.id === target))
            fail("Choose one of the reviewed in-campus candidates.");
          const reason = text(
            b.review_reason,
            "Duplicate verification reason",
            1000,
          );
          resolutions.push({
            row: row.index,
            student_id: target,
            mode: "reviewed",
            reason,
            reviewed_by: actor.userId,
          });
          linked++;
          continue;
        }
        if (decision !== "new" || row.status !== "new")
          fail("Possible duplicates cannot be created as new identities.");
        const r = row.row;
        state.students.push({
          id: id(),
          student_code: r.student_code,
          full_name: r.full_name,
          dob: r.dob ? date(r.dob) : null,
          email: r.email || "",
          guardian_name: r.guardian_name || "",
          guardian_email: r.guardian_email || "",
          phone: r.phone || "",
          campus_id: b.campus_id,
          department_id: b.department_id,
          class_name: r.class_name || "Year 1 · A",
          academic_year: "2026–27",
          status: "pending",
          admitted_on: today(),
        });
        added++;
      }
      if (!added && !linked)
        fail("Select at least one valid new or existing record.");
      state.imports.push({
        id: id(),
        campus_id: b.campus_id,
        fingerprint: preview.fingerprint,
        source_name: text(b.source_name || "CSV import", "Source name"),
        added,
        linked,
        skipped,
        resolutions,
        rows: b.rows,
        created_at: new Date().toISOString(),
        created_by: actor.userId,
      });
      result.message = `Imported ${added} new identities; linked ${linked}; skipped ${skipped}.`;
      break;
    }
    case "user.toggle": {
      requireRole(actor, ["system_admin"]);
      const u = find(state.users, b.user_id, "User");
      if (u.id === actor.userId)
        fail("You cannot deactivate your own account.");
      u.is_active = !u.is_active;
      result.message = `Application access ${u.is_active ? "enabled" : "disabled"}.`;
      break;
    }
    default:
      fail("Unknown action.", 404);
  }
  state.audit.push({
    id: id(),
    at: new Date().toISOString(),
    actor: actor.profile.full_name,
    actor_id: actor.userId,
    action,
    campus_id: campusId || null,
    entity:
      result.id || b.student_id || b.staff_id || b.request_id || "workspace",
    details: b.reason || result.message,
  });
  return result;
}
