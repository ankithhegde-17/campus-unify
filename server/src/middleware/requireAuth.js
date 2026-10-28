import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase configuration in server/.env.");
}

export async function requireAuth(req, res, next) {
  res.set("Cache-Control", "no-store");

  const authorization = req.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(\S+)$/i);

  if (!match) {
    return res.status(401).json({
      error: "Sign in to access this resource.",
    });
  }

  const token = match[1];

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({
        error: "Your session is invalid or expired. Sign in again.",
      });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) throw profileError;

    if (!profile || !profile.is_active) {
      return res.status(403).json({
        error: "Your application profile is missing or inactive.",
      });
    }

    const { data: assignments, error: assignmentError } =
      await supabase
        .from("role_assignments")
        .select("id, role_code, scope, campus_id, department_id")
        .eq("user_id", user.id);

    if (assignmentError) throw assignmentError;

    req.auth = {
      userId: user.id,
      profile,
      assignments: assignments ?? [],
    };

    req.supabase = supabase;

    return next();
  } catch (error) {
    console.error("Authentication lookup failed:", error.message);

    return res.status(503).json({
      error: "Unable to verify access right now. Please try again.",
    });
  }
}
