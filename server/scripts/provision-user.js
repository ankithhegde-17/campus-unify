// Explicit administrator-only CLI. Never expose this as an unauthenticated route.
import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createStore } from "../src/store.js";
import { ROLES } from "../src/domain/seed.js";
const args = {};
for (let i = 2; i < process.argv.length; i += 2)
  args[process.argv[i].replace(/^--/, "")] = process.argv[i + 1];
const { email, name, role, campus, department } = args;
if (!email || !name || !ROLES.includes(role))
  throw new Error(
    'Required: --email EMAIL --name "Full Name" --role ROLE. Campus staff also need --campus CAMPUS-A. See docs/SUPABASE.md.',
  );
const store = await createStore({ mode: "supabase" }),
  state = await store.read(),
  admin = store.admin;
const c = state.campuses.find((c) => c.code === campus),
  d = state.departments.find(
    (d) => d.campus_id === c?.id && d.code === department,
  );
const global = ["trust_management", "system_admin", "auditor"].includes(role),
  self = ["student", "parent"].includes(role);
if (!global && !self && !c) throw new Error("Choose a valid campus code.");
if (role === "hod" && !d) throw new Error("HOD needs --department CSE or GEN.");
const student = state.students.find(
  (s) => s.student_code === args["student-code"],
);
if (self && !student)
  throw new Error("Student/parent needs an existing --student-code.");
if (role === "parent" && args.verified !== "true")
  throw new Error(
    "Parent relationship must first be verified. Add --verified true only after verification.",
  );
const staff = state.staff.find((s) => s.staff_code === args["staff-code"]);
if (["faculty", "hod"].includes(role) && (!staff || staff.campus_id !== c.id))
  throw new Error(
    "Faculty/HOD needs --staff-code for an active appointment in this campus.",
  );
if (staff?.status === "inactive")
  throw new Error("Cannot grant access to an inactive appointment.");
const password =
  process.env.NEW_USER_PASSWORD || randomBytes(18).toString("base64url");
let existing;
for (let page = 1; ; page++) {
  const { data, error } = await admin.auth.admin.listUsers({
    page,
    perPage: 100,
  });
  if (error) throw error;
  existing = data.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  );
  if (existing || data.users.length < 100) break;
}
let user = existing;
if (!user) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  user = data.user;
}
const { error: pe } = await admin
  .from("profiles")
  .upsert({ id: user.id, full_name: name, is_active: true });
if (pe) throw pe;
if (c) {
  const { error } = await admin.from("campuses").upsert(
    {
      id: c.id,
      code: c.code,
      name: c.name,
      institution_type: c.institution_type,
      is_active: true,
    },
    { onConflict: "code" },
  );
  if (error) throw error;
}
if (d) {
  const { error } = await admin
    .from("departments")
    .upsert(d, { onConflict: "campus_id,code" });
  if (error) throw error;
}
const { data: prior, error: re } = await admin
  .from("role_assignments")
  .select("id")
  .eq("user_id", user.id)
  .eq("role_code", role)
  .is("revoked_at", null);
if (re) throw re;
// Reprovisioning this role retires its previous scopes rather than retaining old campus access.
if (prior.length) {
  const { error } = await admin
    .from("role_assignments")
    .update({ revoked_at: new Date().toISOString() })
    .in(
      "id",
      prior.map((r) => r.id),
    );
  if (error) throw error;
}
const { error: ae } = await admin.from("role_assignments").insert({
  user_id: user.id,
  role_code: role,
  scope: self
    ? "self"
    : role === "hod"
      ? "department"
      : global
        ? "trust"
        : "campus",
  campus_id: self || global ? null : c.id,
  department_id: role === "hod" ? d.id : null,
  granted_by: null,
});
if (ae) throw ae;
await store.mutate((state) => {
  const profile = {
    id: user.id,
    full_name: name,
    email,
    role,
    campus_id: global || self ? null : c.id,
    department_id: d?.id || null,
    student_id: student?.id,
    staff_id: staff?.id,
    relationship_verified: role === "parent",
    is_active: true,
  };
  const ix = state.users.findIndex((u) => u.id === user.id);
  if (ix >= 0) state.users[ix] = profile;
  else state.users.push(profile);
  state.teaching = state.teaching.filter((t) => t.user_id !== user.id);
  if (role === "faculty")
    state.teaching.push({
      id: randomUUID(),
      user_id: user.id,
      campus_id: c.id,
      department_id: staff.department_id,
      class_name: args.class || "Year 1 · A",
      subject: args.subject || "Computer Fundamentals",
    });
  if (role === "warden")
    state.beds
      .filter((b) => b.campus_id === c.id)
      .forEach((b) => (b.warden_user_id = user.id));
  state.audit.push({
    id: randomUUID(),
    at: new Date().toISOString(),
    actor: "Administrator CLI",
    action: "user.provision",
    entity: user.id,
    campus_id: c?.id || null,
    details: `Granted ${role}; relationship manually verified where required`,
  });
});
console.log(`Account ready: ${email} (${role})`);
if (!existing) console.log(`Initial password (save privately): ${password}`);
else console.log("Existing password unchanged.");
