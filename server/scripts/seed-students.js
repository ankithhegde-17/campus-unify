// Adds fictional students to the workspace (demo JSON file or Supabase cu_workspace,
// following APP_MODE). Rerunning replaces the previous dummy batch instead of duplicating it.
// Stop the API server first: in demo mode it keeps the old state in memory and would overwrite this.
import { randomUUID } from "node:crypto";
import { createStore } from "../src/store.js";
const count = Number(process.argv[2] || 10000);
if (!Number.isInteger(count) || count < 1 || count > 99999)
  throw new Error("Usage: node scripts/seed-students.js [count 1-99999]");
const DOMAIN = "@students.campus-unify.test";
const ANNUAL_FEE = 200000;
const campusNames = [
  "Maharaja Institute of Technology, Thandavapura",
  "Maharaja Institute of Technology, Mysuru",
  "Maharaja First Grade College, JP Nagar",
  "Maharaja Medical College",
  "Maharaja Institute of Technology, Bengaluru",
  "Maharaja First Grade College, Mysore",
];
const thandavapuraDepartments = [
  { code: "CSE", name: "CSE", studentsPerYear: 120 },
  { code: "AIML", name: "CSE (AI & ML)", studentsPerYear: 60 },
  { code: "AIDS", name: "Artificial Intelligence and Data Science", studentsPerYear: 60 },
  { code: "ECE", name: "ECE", studentsPerYear: 60 },
  { code: "CIVIL", name: "Civil Engineering", studentsPerYear: 30 },
  { code: "MECH", name: "Mechanical Engineering", studentsPerYear: 60 },
];
const firstNames = [
  "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Ayaan", "Krishna", "Ishaan",
  "Shaurya", "Atharv", "Advik", "Pranav", "Rohan", "Karthik", "Nikhil", "Rahul", "Varun", "Siddharth",
  "Ananya", "Diya", "Aadhya", "Saanvi", "Pari", "Ira", "Myra", "Anika", "Navya", "Kavya",
  "Meera", "Riya", "Sneha", "Pooja", "Divya", "Lakshmi", "Shreya", "Nandini", "Priya", "Tanvi",
];
const lastNames = [
  "Sharma", "Verma", "Iyer", "Nair", "Reddy", "Rao", "Hegde", "Shetty", "Kulkarni", "Patil",
  "Joshi", "Desai", "Menon", "Pillai", "Gowda", "Naik", "Kamath", "Bhat", "Pai", "Shenoy",
  "Gupta", "Mehta", "Shah", "Singh", "Kumar", "Das", "Mishra", "Pandey", "Kapoor", "Bose",
];
const years = [
  { year: "2023–24", admitted: "2023-07-01", label: "Year 4" },
  { year: "2024–25", admitted: "2024-07-01", label: "Year 3" },
  { year: "2025–26", admitted: "2025-07-01", label: "Year 2" },
  { year: "2026–27", admitted: "2026-07-01", label: "Year 1" },
];
const store = await createStore();
const added = await store.mutate((state) => {
  const campuses = state.campuses.filter((c) => c.is_active !== false);
  const thandavapura = campuses.find((campus) => campus.code === "CAMPUS-A");
  if (!thandavapura) throw new Error("Maharaja Institute of Technology, Thandavapura is missing.");
  for (const [index, definition] of thandavapuraDepartments.entries()) {
    const existing = state.departments.find(
      (department) =>
        department.campus_id === thandavapura.id &&
        (department.code === definition.code ||
          (index === 1 && department.code === "GEN")),
    );
    if (existing) {
      existing.code = definition.code;
      existing.name = definition.name;
      existing.is_active = true;
    } else {
      state.departments.push({
        id: randomUUID(),
        campus_id: thandavapura.id,
        code: definition.code,
        name: definition.name,
        is_active: true,
      });
    }
  }
  const depts = new Map(
    campuses.map((c) => [
      c.id,
      state.departments.filter((d) => d.campus_id === c.id && d.is_active !== false),
    ]),
  );
  if (!campuses.length || campuses.some((c) => !depts.get(c.id).length))
    throw new Error("Every active campus needs at least one active department.");
  const previousDummyStudentIds = new Set(
    state.students
      .filter((s) => s.email?.endsWith(DOMAIN))
      .map((s) => s.id),
  );
  const removedChargeIds = new Set(
    state.charges
      .filter((charge) => previousDummyStudentIds.has(charge.student_id))
      .map((charge) => charge.id),
  );
  state.students = state.students.filter((s) => !previousDummyStudentIds.has(s.id));
  state.charges = state.charges.filter((charge) => !removedChargeIds.has(charge.id));
  state.payments = state.payments.filter((payment) => !removedChargeIds.has(payment.charge_id));
  state.campuses.forEach((campus, index) => {
    if (index < campusNames.length) campus.name = campusNames[index];
  });
  state.rules.forEach((rule) => {
    rule.tuition = ANNUAL_FEE;
  });
  state.charges.forEach((charge) => {
    if (charge.head === "Annual tuition") charge.amount = ANNUAL_FEE;
  });
  for (let n = 1; n <= count; n++) {
    const c = campuses[n % campuses.length],
      ds = depts.get(c.id),
      y = years[n % years.length],
      first = firstNames[(n * 7) % firstNames.length],
      last = lastNames[(n * 13 + Math.floor(n / 40)) % lastNames.length];
    const student = {
      id: randomUUID(),
      student_code: `DS${String(n).padStart(5, "0")}`,
      full_name: `${first} ${last}`,
      dob: `${2002 + (n % 6)}-${String((n % 12) + 1).padStart(2, "0")}-${String((n % 28) + 1).padStart(2, "0")}`,
      campus_id: c.id,
      department_id: ds[Math.floor(n / campuses.length) % ds.length].id,
      class_name: `${y.label} · ${"ABCD"[n % 4]}`,
      email: `student${String(n).padStart(5, "0")}${DOMAIN}`,
      guardian_name: `${firstNames[(n * 11) % firstNames.length]} ${last}`,
      guardian_email: `guardian${String(n).padStart(5, "0")}${DOMAIN}`,
      phone: `9${String(100000000 + n).padStart(9, "0")}`,
      status: n % 25 === 0 ? "pending" : "active",
      admitted_on: y.admitted,
      academic_year: y.year,
    };
    state.students.push(student);
    state.charges.push({
      id: randomUUID(),
      student_id: student.id,
      campus_id: student.campus_id,
      head: "Annual tuition",
      amount: ANNUAL_FEE,
      concession: 0,
      due_date: "2026-10-01",
      rule_id: state.rules.find((rule) => rule.campus_id === student.campus_id)?.id || null,
      academic_year: student.academic_year,
    });
  }
  const studentsWithAnnualFee = new Set(
    state.charges
      .filter((charge) => charge.head === "Annual tuition")
      .map((charge) => charge.student_id),
  );
  for (const student of state.students) {
    if (studentsWithAnnualFee.has(student.id)) continue;
    state.charges.push({
      id: randomUUID(),
      student_id: student.id,
      campus_id: student.campus_id,
      head: "Annual tuition",
      amount: ANNUAL_FEE,
      concession: 0,
      due_date: "2026-10-01",
      rule_id: state.rules.find((rule) => rule.campus_id === student.campus_id)?.id || null,
      academic_year: student.academic_year,
    });
  }
  const thandavapuraDepartmentRecords = thandavapuraDepartments.map((definition) =>
    state.departments.find(
      (department) =>
        department.campus_id === thandavapura.id && department.code === definition.code,
    ),
  );
  const placements = thandavapuraDepartments.flatMap((definition, departmentIndex) =>
    [1, 2, 3, 4].flatMap((year) =>
      Array.from({ length: definition.studentsPerYear }, () => ({
        departmentId: thandavapuraDepartmentRecords[departmentIndex].id,
        year,
      })),
    ),
  );
  const thandavapuraStudents = state.students.filter(
    (student) => student.campus_id === thandavapura.id,
  );
  const academicYearsByStudyYear = {
    1: "2026–27",
    2: "2025–26",
    3: "2024–25",
    4: "2023–24",
  };
  thandavapuraStudents.slice(0, placements.length).forEach((student, index) => {
    const placement = placements[index];
    student.department_id = placement.departmentId;
    student.class_name = `Year ${placement.year} · ${"ABCD"[index % 4]}`;
    student.academic_year = academicYearsByStudyYear[placement.year];
  });
  const otherCampuses = campuses.filter((campus) => campus.id !== thandavapura.id);
  thandavapuraStudents.slice(placements.length).forEach((student, index) => {
    const campus = otherCampuses[index % otherCampuses.length];
    student.campus_id = campus.id;
    student.department_id = depts.get(campus.id)[index % depts.get(campus.id).length].id;
  });
  const studentById = new Map(state.students.map((student) => [student.id, student]));
  state.charges.forEach((charge) => {
    const student = studentById.get(charge.student_id);
    if (student) charge.campus_id = student.campus_id;
  });
  state.payments.forEach((payment) => {
    const student = studentById.get(payment.student_id);
    if (student) payment.campus_id = student.campus_id;
  });
  return state.students.length;
});
console.log(`${store.mode} mode: added ${count} dummy students (${added} total).`);
