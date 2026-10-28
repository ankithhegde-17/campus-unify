// Adds fictional students to the workspace (demo JSON file or Supabase cu_workspace,
// following APP_MODE). Rerunning replaces the previous dummy batch instead of duplicating it.
// Stop the API server first: in demo mode it keeps the old state in memory and would overwrite this.
import { randomUUID } from "node:crypto";
import { createStore } from "../src/store.js";
const count = Number(process.argv[2] || 10000);
if (!Number.isInteger(count) || count < 1 || count > 99999)
  throw new Error("Usage: node scripts/seed-students.js [count 1-99999]");
const DOMAIN = "@students.campus-unify.test";
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
  const depts = new Map(
    campuses.map((c) => [
      c.id,
      state.departments.filter((d) => d.campus_id === c.id && d.is_active !== false),
    ]),
  );
  if (!campuses.length || campuses.some((c) => !depts.get(c.id).length))
    throw new Error("Every active campus needs at least one active department.");
  state.students = state.students.filter((s) => !s.email?.endsWith(DOMAIN));
  for (let n = 1; n <= count; n++) {
    const c = campuses[n % campuses.length],
      ds = depts.get(c.id),
      y = years[n % years.length],
      first = firstNames[(n * 7) % firstNames.length],
      last = lastNames[(n * 13 + Math.floor(n / 40)) % lastNames.length];
    state.students.push({
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
    });
  }
  return state.students.length;
});
console.log(`${store.mode} mode: added ${count} dummy students (${added} total).`);
