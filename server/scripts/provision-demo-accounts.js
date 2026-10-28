// Explicit administrator-only CLI: creates Supabase logins for the eleven
// seeded stakeholder accounts (<role>@demo.local) so a Supabase deployment
// can be demonstrated like demo mode. Each login reuses the id of its seeded
// workspace user, so student/parent, faculty, HOD and warden links work
// without rewriting the workspace.
//   node --env-file=.env scripts/provision-demo-accounts.js --password "Demo@123"
import { createClient } from "@supabase/supabase-js";
const i = process.argv.indexOf("--password"),
  password = i > 0 ? process.argv[i + 1] : null;
if (!password || password.length < 6)
  throw new Error('Required: --password "..." (at least 6 characters).');
const admin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const { data: workspace, error: we } = await admin
  .from("cu_workspace")
  .select("payload->users")
  .eq("id", "main")
  .single();
if (we) throw we;
const users = workspace.users.filter((u) => u.email?.endsWith("@demo.local"));
if (!users.length) throw new Error("No seeded @demo.local users in the workspace.");

for (const u of users) {
  const self = ["student", "parent"].includes(u.role),
    global = ["trust_management", "system_admin", "auditor"].includes(u.role);
  const { data: found } = await admin.auth.admin.getUserById(u.id);
  if (found?.user) {
    const { error } = await admin.auth.admin.updateUserById(u.id, {
      password,
      email_confirm: true,
    });
    if (error) throw error;
  } else {
    const { error } = await admin.auth.admin.createUser({
      id: u.id,
      email: u.email,
      password,
      email_confirm: true,
    });
    if (error)
      throw new Error(
        `${u.email}: ${error.message}. If this email already has a different login, delete it in Supabase → Authentication → Users and run this again.`,
      );
  }
  const { error: pe } = await admin
    .from("profiles")
    .upsert({ id: u.id, full_name: u.full_name, is_active: true });
  if (pe) throw pe;
  // Replace any earlier grant for this role so reruns stay idempotent.
  const { error: re } = await admin
    .from("role_assignments")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", u.id)
    .eq("role_code", u.role)
    .is("revoked_at", null);
  if (re) throw re;
  const { error: ae } = await admin.from("role_assignments").insert({
    user_id: u.id,
    role_code: u.role,
    scope: self ? "self" : u.role === "hod" ? "department" : global ? "trust" : "campus",
    campus_id: self || global ? null : u.campus_id,
    department_id: u.role === "hod" ? u.department_id : null,
    granted_by: null,
  });
  if (ae) throw new Error(`${u.email}: ${ae.message}`);
  console.log(`Ready: ${u.email} (${u.role})`);
}
console.log(`\n${users.length} demo accounts can sign in with the password you chose.`);
