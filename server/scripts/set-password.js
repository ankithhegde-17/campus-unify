// Explicit administrator-only CLI: sets a new password for an existing
// Supabase account. The password comes from NEW_USER_PASSWORD so it never
// appears in shell history arguments or source control.
//   PowerShell: $env:NEW_USER_PASSWORD = "..."; node --env-file=.env scripts/set-password.js --email you@example.com
import { createClient } from "@supabase/supabase-js";
const i = process.argv.indexOf("--email"),
  email = i > 0 ? process.argv[i + 1]?.toLowerCase() : null,
  password = process.env.NEW_USER_PASSWORD;
if (!email) throw new Error("Required: --email EMAIL");
if (!password || password.length < 8)
  throw new Error("Set NEW_USER_PASSWORD to a password of at least 8 characters.");
const admin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
let user;
for (let page = 1; !user; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  user = data.users.find((u) => u.email?.toLowerCase() === email);
  if (data.users.length < 1000) break;
}
if (!user) throw new Error(`No account found for ${email}.`);
const { error } = await admin.auth.admin.updateUserById(user.id, { password });
if (error) throw error;
console.log(`Password updated for ${email}.`);
