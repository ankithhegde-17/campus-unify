import { randomUUID } from "node:crypto";

export const ROLES = [
  "trust_management",
  "campus_admin",
  "admissions_officer",
  "accounts_officer",
  "hod",
  "faculty",
  "warden",
  "student",
  "parent",
  "system_admin",
  "auditor",
];
export function makeSeed(existingCampuses = [], existingDepartments = []) {
  const today = "2026-10-28";
  const campuses = "ABCDEF".split("").map((letter, i) => {
    const old = existingCampuses.find((c) => c.code === `CAMPUS-${letter}`);
    return {
      id: old?.id || randomUUID(),
      code: `CAMPUS-${letter}`,
      name: old?.name || `Campus ${letter}`,
      institution_type:
        old?.institution_type ||
        [
          "engineering",
          "engineering",
          "polytechnic",
          "polytechnic",
          "school",
          "school",
        ][i],
      is_active: true,
    };
  });
  const departments = campuses.flatMap((c) =>
    ["Computer Science", "General Studies"].map((name, i) => ({
      id:
        existingDepartments.find(
          (d) => d.campus_id === c.id && d.code === (i ? "GEN" : "CSE"),
        )?.id || randomUUID(),
      campus_id: c.id,
      code: i ? "GEN" : "CSE",
      name,
      is_active: true,
    })),
  );
  const users = ROLES.map((role, i) => ({
    id: randomUUID(),
    full_name:
      {
        trust_management: "Arjun Hegde",
        campus_admin: "Meera Rao",
        faculty: "Kavya Shetty",
        hod: "Dr. Priya Nair",
        student: "Ananya Rao",
        parent: "Suresh Rao",
      }[role] || role.replaceAll("_", " "),
    email: `${role}@demo.local`,
    role,
    campus_id: ["trust_management", "system_admin", "auditor"].includes(role)
      ? null
      : campuses[0].id,
    department_id: ["hod", "faculty"].includes(role) ? departments[0].id : null,
    is_active: true,
  }));
  const firstNames = [
    "Ananya",
    "Rohan",
    "Diya",
    "Aarav",
    "Ishaan",
    "Kriti",
    "Neha",
    "Aditya",
    "Sana",
    "Vivek",
    "Tara",
    "Nikhil",
  ];
  const students = campuses.flatMap((c, ci) =>
    firstNames.map((name, i) => ({
      id: randomUUID(),
      student_code: `ST${ci + 1}${String(i + 1).padStart(3, "0")}`,
      full_name: `${name} ${["Rao", "Shetty", "Patel", "Nair"][i % 4]}`,
      dob: `200${i % 5}-0${(i % 8) + 1}-15`,
      campus_id: c.id,
      department_id: departments[ci * 2 + (i % 2)].id,
      class_name: i % 2 ? "Year 2 · B" : "Year 1 · A",
      email: `student${ci * 12 + i + 1}@example.invalid`,
      guardian_name: `Guardian ${ci * 12 + i + 1}`,
      guardian_email: `guardian${ci * 12 + i + 1}@example.invalid`,
      phone: `90000${String(ci * 12 + i + 1).padStart(5, "0")}`,
      status: i === 11 ? "pending" : "active",
      admitted_on: "2026-07-01",
      academic_year: "2026–27",
    })),
  );
  users.find((u) => u.role === "student").student_id = students[0].id;
  users.find((u) => u.role === "parent").student_id = students[0].id;
  users.find((u) => u.role === "parent").relationship_verified = true;
  const staff = campuses.flatMap((c, ci) =>
    ["Dr. Priya Nair", "Kavya Shetty", "Rahul Menon"].map((name, i) => ({
      id: randomUUID(),
      staff_code: `EMP-${ci + 1}${i + 1}`,
      full_name: ci
        ? `${name.split(" ")[0]} ${["Sharma", "Kumar", "Desai"][ci % 3]}`
        : name,
      campus_id: c.id,
      department_id: departments[ci * 2].id,
      designation: i === 0 ? "HOD" : "Assistant Professor",
      qualification: i === 0 ? "PhD" : "M.Tech",
      email: `faculty${ci * 3 + i + 1}@example.invalid`,
      phone: "9000012345",
      started_on: "2026-07-01",
      ended_on: null,
      status: "active",
    })),
  );
  users.find((u) => u.role === "faculty").staff_id = staff[1].id;
  users.find((u) => u.role === "hod").staff_id = staff[0].id;
  const teaching = [
    {
      id: randomUUID(),
      user_id: users.find((u) => u.role === "faculty").id,
      campus_id: campuses[0].id,
      department_id: departments[0].id,
      class_name: "Year 1 · A",
      subject: "Computer Fundamentals",
    },
  ];
  const rules = campuses.map((c, i) => ({
    id: randomUUID(),
    campus_id: c.id,
    version: 1,
    effective_from: "2026-07-01",
    tuition: 80000 - i * 8000,
    hostel: 24000,
    attendance_threshold: i < 4 ? 75 : 80,
    concession_percent: 10,
    late_fee: 0,
    created_at: new Date().toISOString(),
  }));
  const charges = students
    .filter((s) => s.status === "active")
    .map((s, i) => {
      const r = rules.find((r) => r.campus_id === s.campus_id);
      return {
        id: randomUUID(),
        student_id: s.id,
        campus_id: s.campus_id,
        head: "Annual tuition",
        amount: r.tuition,
        concession: i % 5 === 0 ? r.tuition / 10 : 0,
        due_date: "2026-10-01",
        rule_id: r.id,
        academic_year: "2026–27",
      };
    });
  const payments = charges
    .filter((_, i) => i % 4 !== 0)
    .map((ch, i) => ({
      id: randomUUID(),
      student_id: ch.student_id,
      campus_id: ch.campus_id,
      charge_id: ch.id,
      amount: Math.round((ch.amount - ch.concession) * (i % 3 ? 1 : 0.5)),
      reference: `DEMO-BANK-${String(i + 1).padStart(4, "0")}`,
      receipt_no: `CU-2026-${String(i + 1).padStart(5, "0")}`,
      method: i % 2 ? "Bank transfer" : "Cash",
      paid_at: today,
      created_by: "seed",
      kind: "payment",
    }));
  const sessions = campuses.flatMap((c, ci) =>
    Array.from({ length: 10 }, (_, i) => ({
      id: randomUUID(),
      campus_id: c.id,
      department_id: departments[ci * 2].id,
      class_name: "Year 1 · A",
      subject: "Computer Fundamentals",
      date: `2026-10-${String(i + 12).padStart(2, "0")}`,
      locked: i < 7,
    })),
  );
  const attendance = sessions.flatMap((session, si) =>
    students
      .filter(
        (s) =>
          s.campus_id === session.campus_id &&
          s.class_name === session.class_name,
      )
      .map((s, i) => ({
        id: randomUUID(),
        session_id: session.id,
        student_id: s.id,
        campus_id: s.campus_id,
        status:
          i === 0 && si % 3 !== 0
            ? "absent"
            : (i + si) % 7 === 0
              ? "absent"
              : "present",
        marked_by: "seed",
      })),
  );
  const beds = campuses.flatMap((c) =>
    Array.from({ length: 16 }, (_, i) => ({
      id: randomUUID(),
      campus_id: c.id,
      hostel: "Maple Residence",
      room: `${101 + Math.floor(i / 2)}`,
      bed: `${i % 2 ? "B" : "A"}`,
      available: true,
    })),
  );
  beds
    .filter((b) => b.campus_id === campuses[0].id)
    .forEach(
      (b) => (b.warden_user_id = users.find((u) => u.role === "warden").id),
    );
  const allocations = campuses.flatMap((c) =>
    students
      .filter((s) => s.campus_id === c.id)
      .slice(0, 8)
      .map((s, i) => ({
        id: randomUUID(),
        student_id: s.id,
        campus_id: c.id,
        bed_id: beds.filter((b) => b.campus_id === c.id)[i].id,
        starts_on: "2026-07-01",
        ends_on: null,
      })),
  );
  const notices = [
    {
      id: randomUUID(),
      title: "Welcome to the new campus workspace",
      body: "This environment contains fictional demonstration records. Review campus dues, attendance risks and pending approvals from your workspace.",
      campus_id: null,
      audience: "all",
      created_at: new Date().toISOString(),
      created_by: "seed",
    },
  ];
  const scholarships = students
    .filter((_, i) => i % 9 === 0)
    .map((s) => ({
      id: randomUUID(),
      student_id: s.id,
      campus_id: s.campus_id,
      scheme: "Demo merit support",
      amount: 15000,
      status: "application",
      reference: "",
      received: 0,
    }));
  const requests = [
    {
      id: randomUUID(),
      campus_id: campuses[0].id,
      student_id: students[0].id,
      type: "profile_correction",
      details: "Please verify the spelling of my guardian name.",
      status: "pending",
      created_by: users.find((u) => u.role === "student").id,
      created_at: new Date().toISOString(),
    },
  ];
  return {
    meta: { schema: 1, synthetic: true },
    campuses,
    departments,
    users,
    students,
    staff,
    teaching,
    rules,
    charges,
    payments,
    sessions,
    attendance,
    beds,
    allocations,
    notices,
    scholarships,
    requests,
    documents: [],
    acknowledgements: [],
    transfers: [],
    imports: [],
    audit: [
      {
        id: randomUUID(),
        at: new Date().toISOString(),
        actor: "System",
        action: "demo.seed",
        entity: "workspace",
        details:
          "72 fictional student records across six campuses; generated by Campus Unify, not organizer ground truth.",
      },
    ],
  };
}
