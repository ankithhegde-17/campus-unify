export const MODULES = {
  trust_management: [
    "overview",
    "students",
    "staff",
    "finance",
    "attendance",
    "hostels",
    "scholarships",
    "approvals",
    "rules",
    "imports",
    "reports",
    "notices",
    "users",
    "audit",
  ],
  campus_admin: [
    "overview",
    "students",
    "staff",
    "finance",
    "attendance",
    "hostels",
    "scholarships",
    "approvals",
    "rules",
    "imports",
    "reports",
    "notices",
    "audit",
  ],
  admissions_officer: [
    "overview",
    "students",
    "imports",
    "approvals",
    "notices",
  ],
  accounts_officer: [
    "overview",
    "students",
    "finance",
    "scholarships",
    "approvals",
    "reports",
    "notices",
  ],
  hod: ["overview", "students", "staff", "attendance", "approvals", "notices"],
  faculty: ["overview", "students", "attendance", "approvals", "notices"],
  warden: ["overview", "students", "hostels", "approvals", "notices"],
  student: [
    "overview",
    "students",
    "finance",
    "attendance",
    "hostels",
    "scholarships",
    "approvals",
    "notices",
  ],
  parent: [
    "overview",
    "students",
    "finance",
    "attendance",
    "hostels",
    "scholarships",
    "approvals",
    "notices",
  ],
  system_admin: ["overview", "users", "audit"],
  auditor: ["overview", "finance", "reports", "audit"],
};
export function hasRole(actor, ...roles) {
  return actor.assignments.some((a) => roles.includes(a.role_code));
}
export function trust(actor) {
  return actor.assignments.some(
    (a) => a.role_code === "trust_management" && a.scope === "trust",
  );
}
export function campusAccess(actor, id) {
  return (
    trust(actor) ||
    actor.assignments.some(
      (a) =>
        a.scope !== "self" &&
        !["student", "parent"].includes(a.role_code) &&
        a.campus_id === id,
    ) ||
    actor.assignments.some(
      (a) => a.role_code === "auditor" && a.scope === "trust",
    )
  );
}
export function requireRole(actor, roles, campusId) {
  if (!hasRole(actor, ...roles) || (campusId && !campusAccess(actor, campusId)))
    fail("You do not have permission for this action.", 403);
}
export function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}
export function capabilities(actor) {
  return [
    ...new Set(actor.assignments.flatMap((a) => MODULES[a.role_code] || [])),
  ];
}
export function studentAllowed(state, actor, s) {
  if (trust(actor)) return true;
  return actor.assignments.some((a) => {
    if (["student", "parent"].includes(a.role_code))
      return state.users.some(
        (u) =>
          u.id === actor.userId &&
          u.student_id === s.id &&
          u.role === a.role_code &&
          u.is_active &&
          (a.role_code !== "parent" || u.relationship_verified === true),
      );
    if (a.role_code === "auditor")
      return a.scope === "trust" || a.campus_id === s.campus_id;
    if (a.campus_id !== s.campus_id) return false;
    if (a.role_code === "hod") return a.department_id === s.department_id;
    if (a.role_code === "faculty")
      return state.teaching.some(
        (t) =>
          t.user_id === actor.userId &&
          t.campus_id === s.campus_id &&
          t.department_id === s.department_id &&
          t.class_name === s.class_name,
      );
    if (a.role_code === "warden")
      return state.beds.some(
        (b) => b.campus_id === s.campus_id && b.warden_user_id === actor.userId,
      );
    return ["campus_admin", "admissions_officer", "accounts_officer"].includes(
      a.role_code,
    );
  });
}
export function safeView(state, actor) {
  const modules = capabilities(actor),
    can = (m) => modules.includes(m);
  const assignedStudentIds = new Set(
    state.students
      .filter((s) => studentAllowed(state, actor, s))
      .map((s) => s.id),
  );
  const historicStudents = can("finance")
    ? state.students.filter(
        (s) =>
          !assignedStudentIds.has(s.id) &&
          state.charges.some(
            (ch) => ch.student_id === s.id && campusAccess(actor, ch.campus_id),
          ),
      )
    : [];
  const historicIds = new Set(historicStudents.map((s) => s.id));
  const students =
    can("students") || can("finance") || can("attendance")
      ? state.students
          .filter((s) => assignedStudentIds.has(s.id))
          .map((s) => {
            const base = {
              id: s.id,
              student_code: s.student_code,
              full_name: s.full_name,
              campus_id: s.campus_id,
              department_id: s.department_id,
              class_name: s.class_name,
              status: s.status,
              academic_year: s.academic_year,
            };
            if (
              hasRole(
                actor,
                "trust_management",
                "campus_admin",
                "admissions_officer",
                "student",
                "parent",
              )
            )
              Object.assign(base, {
                email: s.email,
                guardian_name: s.guardian_name,
                guardian_email: s.guardian_email,
                dob: s.dob,
                phone: s.phone,
                admitted_on: s.admitted_on,
              });
            if (hasRole(actor, "accounts_officer"))
              base.guardian_email = s.guardian_email;
            if (hasRole(actor, "warden"))
              Object.assign(base, {
                guardian_name: s.guardian_name,
                phone: s.phone,
              });
            return base;
          })
      : [];
  for (const s of historicStudents) {
    const ch = state.charges.find(
      (ch) => ch.student_id === s.id && campusAccess(actor, ch.campus_id),
    );
    students.push({
      id: s.id,
      student_code: s.student_code,
      full_name: s.full_name,
      campus_id: ch.campus_id,
      class_name: "Historical enrolment",
      status: "transferred",
      academic_year: s.academic_year,
    });
  }
  const personal =
    hasRole(actor, "student", "parent") &&
    !hasRole(actor, "trust_management", "campus_admin");
  const relevantCampus = (id) =>
    campusAccess(actor, id) ||
    (personal &&
      state.students.some(
        (s) => assignedStudentIds.has(s.id) && s.campus_id === id,
      ));
  const staff = can("staff")
    ? state.staff.filter(
        (s) =>
          trust(actor) ||
          actor.assignments.some(
            (a) =>
              a.campus_id === s.campus_id &&
              (a.role_code === "campus_admin" ||
                (a.role_code === "hod" && a.department_id === s.department_id)),
          ),
      )
    : [];
  const allocations = can("hostels")
    ? state.allocations.filter((a) => assignedStudentIds.has(a.student_id))
    : [];
  const allowedBeds = new Set(allocations.map((a) => a.bed_id));
  return {
    meta: state.meta,
    profile: actor.profile,
    assignments: actor.assignments,
    modules,
    campuses: state.campuses.filter((c) => relevantCampus(c.id)),
    departments: state.departments.filter(
      (d) =>
        relevantCampus(d.campus_id) &&
        (!hasRole(actor, "hod") ||
          trust(actor) ||
          actor.assignments.some(
            (a) => a.role_code === "campus_admin" || a.department_id === d.id,
          )),
    ),
    students,
    staff: staff.map((s) => ({
      ...s,
      portal_user_id:
        state.users.find((u) => u.staff_id === s.id && u.is_active)?.id || null,
    })),
    teaching:
      can("staff") || can("attendance")
        ? state.teaching.filter(
            (t) =>
              t.user_id === actor.userId ||
              trust(actor) ||
              actor.assignments.some(
                (a) =>
                  a.campus_id === t.campus_id &&
                  (a.role_code === "campus_admin" ||
                    a.department_id === t.department_id),
              ),
          )
        : [],
    users: can("users")
      ? state.users
          .filter(
            (u) =>
              trust(actor) ||
              hasRole(actor, "system_admin") ||
              campusAccess(actor, u.campus_id),
          )
          .map(({ student_id, staff_id, ...u }) => u)
      : [],
    rules: state.rules
      .filter((r) => relevantCampus(r.campus_id))
      .map((r) =>
        can("rules") || can("finance")
          ? r
          : {
              id: r.id,
              campus_id: r.campus_id,
              version: r.version,
              effective_from: r.effective_from,
              attendance_threshold: r.attendance_threshold,
            },
      ),
    charges: can("finance")
      ? state.charges.filter(
          (c) =>
            (assignedStudentIds.has(c.student_id) ||
              historicIds.has(c.student_id)) &&
            (personal || campusAccess(actor, c.campus_id)),
        )
      : [],
    payments: can("finance")
      ? state.payments.filter(
          (p) =>
            (assignedStudentIds.has(p.student_id) ||
              historicIds.has(p.student_id)) &&
            (personal || campusAccess(actor, p.campus_id)),
        )
      : [],
    sessions: can("attendance")
      ? state.sessions.filter(
          (s) =>
            relevantCampus(s.campus_id) &&
            state.students.some(
              (st) =>
                assignedStudentIds.has(st.id) &&
                st.department_id === s.department_id &&
                st.class_name === s.class_name,
            ),
        )
      : [],
    attendance: can("attendance")
      ? state.attendance.filter((a) => assignedStudentIds.has(a.student_id))
      : [],
    beds: can("hostels")
      ? state.beds.filter((b) =>
          personal
            ? allowedBeds.has(b.id)
            : hasRole(actor, "warden") &&
                !hasRole(actor, "trust_management", "campus_admin")
              ? b.warden_user_id === actor.userId
              : relevantCampus(b.campus_id),
        )
      : [],
    allocations,
    scholarships: can("scholarships")
      ? state.scholarships.filter((s) => assignedStudentIds.has(s.student_id))
      : [],
    notices: can("notices")
      ? state.notices.filter(
          (n) =>
            (!n.campus_id || relevantCampus(n.campus_id)) &&
            (n.audience === "all" ||
              hasRole(actor, n.audience) ||
              trust(actor)),
        )
      : [],
    report_rows: can("reports")
      ? state.campuses
          .filter((c) => campusAccess(actor, c.id))
          .map((c) => {
            const ss = state.students.filter((s) => s.campus_id === c.id),
              net = state.charges
                .filter((ch) => ch.campus_id === c.id)
                .reduce((n, ch) => n + ch.amount - ch.concession, 0),
              paid = state.payments
                .filter((p) => p.campus_id === c.id)
                .reduce((n, p) => n + p.amount, 0);
            const rule = state.rules
              .filter(
                (r) =>
                  r.campus_id === c.id &&
                  r.effective_from <= new Date().toISOString().slice(0, 10),
              )
              .sort(
                (a, b) =>
                  b.effective_from.localeCompare(a.effective_from) ||
                  b.version - a.version,
              )[0];
            const risk = ss.filter((s) => {
              const sessions = new Set(
                  state.sessions
                    .filter(
                      (x) =>
                        x.campus_id === s.campus_id &&
                        x.department_id === s.department_id &&
                        x.class_name === s.class_name,
                    )
                    .map((x) => x.id),
                ),
                entries = state.attendance.filter(
                  (a) =>
                    a.student_id === s.id &&
                    sessions.has(a.session_id) &&
                    a.status !== "excused",
                );
              return (
                entries.length &&
                (entries.filter((a) => a.status === "present").length /
                  entries.length) *
                  100 <
                  (rule?.attendance_threshold || 75)
              );
            }).length;
            return {
              id: c.id,
              campus_id: c.id,
              campus: c.name,
              students: ss.length,
              net_charges: net,
              collected: paid,
              outstanding: Math.round((net - paid) * 100) / 100,
              beds: state.beds.filter((b) => b.campus_id === c.id).length,
              occupied: state.allocations.filter(
                (a) => a.campus_id === c.id && !a.ends_on,
              ).length,
              attendance_risk: risk,
            };
          })
      : [],
    documents: hasRole(
      actor,
      "trust_management",
      "campus_admin",
      "admissions_officer",
      "student",
      "parent",
    )
      ? (state.documents || [])
          .filter((doc) => assignedStudentIds.has(doc.student_id))
          .map(({ storage_key, ...doc }) => doc)
      : [],
    acknowledgements: (state.acknowledgements || []).filter(
      (a) => a.user_id === actor.userId,
    ),
    requests: can("approvals")
      ? state.requests.filter(
          (r) =>
            r.created_by === actor.userId ||
            ((trust(actor) || hasRole(actor, "campus_admin")) &&
              relevantCampus(r.campus_id)),
        )
      : [],
    imports: can("imports")
      ? state.imports.filter((i) => relevantCampus(i.campus_id))
      : [],
    transfers: can("students")
      ? state.transfers.filter((t) => assignedStudentIds.has(t.student_id))
      : [],
    audit: can("audit")
      ? state.audit
          .filter(
            (a) =>
              trust(actor) ||
              hasRole(actor, "system_admin") ||
              (!a.campus_id
                ? hasRole(actor, "auditor")
                : campusAccess(actor, a.campus_id)),
          )
          .slice(-100)
          .reverse()
      : [],
  };
}
