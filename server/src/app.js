import express from "express";
import { documentRoutes } from "./documents.js";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { capabilities, safeView, fail } from "./domain/access.js";
import { act, previewImport } from "./domain/actions.js";
export function createApp(store) {
  const app = express(),
    sessions = new Map(),
    attempts = new Map();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));
  app.use("/api", (_req, res, next) => {
    res.set({
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    next();
  });
  app.get("/api/health", (_req, res) =>
    res.json({
      status: "ok",
      mode: store.mode,
      message: "Campus Unify backend is running",
    }),
  );
  app.get("/api/config", (_req, res) =>
    res.json({
      mode: store.mode,
      demoAccounts: store.mode === "demo",
      supabaseUrl:
        store.mode === "supabase" ? process.env.SUPABASE_URL : undefined,
      publishableKey:
        store.mode === "supabase"
          ? process.env.SUPABASE_PUBLISHABLE_KEY
          : undefined,
    }),
  );
  app.post("/api/auth/demo", async (req, res) => {
    if (store.mode !== "demo") fail("Demo authentication is disabled.", 404);
    const key = req.ip,
      now = Date.now();
    let rate = attempts.get(key);
    if (!rate || now - rate.start > 60000) {
      rate = { start: now, count: 0 };
      attempts.set(key, rate);
    }
    if (++rate.count > 30)
      fail("Too many attempts. Try again in a minute.", 429);
    const state = await store.read(),
      user = state.users.find(
        (u) => u.email === req.body?.email && u.is_active,
      );
    if (!user || req.body?.password !== "Demo@12345")
      fail("Invalid demo credentials.", 401);
    const token = randomBytes(32).toString("hex");
    sessions.set(token, { userId: user.id, expires: now + 8 * 60 * 60 * 1000 });
    res.json({ token });
  });
  app.use("/api", async (req, res, next) => {
    const token = (req.get("authorization") || "").match(
      /^Bearer\s+(\S+)$/i,
    )?.[1];
    if (!token) fail("Sign in to access this resource.", 401);
    const state = await store.read();
    let actor;
    if (store.mode === "demo") {
      const session = sessions.get(token);
      if (!session || session.expires < Date.now())
        fail("Session expired. Sign in again.", 401);
      const u = state.users.find((u) => u.id === session.userId);
      if (!u?.is_active) fail("Account is inactive.", 403);
      actor = {
        userId: u.id,
        profile: { id: u.id, full_name: u.full_name, is_active: true },
        assignments: [
          {
            role_code: u.role,
            scope: ["student", "parent"].includes(u.role)
              ? "self"
              : u.role === "hod"
                ? "department"
                : u.campus_id
                  ? "campus"
                  : "trust",
            campus_id: u.campus_id,
            department_id: u.department_id,
          },
        ],
        email: u.email,
      };
    } else {
      const client = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_PUBLISHABLE_KEY,
        {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        },
      );
      const {
        data: { user },
        error,
      } = await client.auth.getUser(token);
      if (error || !user) fail("Session expired. Sign in again.", 401);
      const { data: profile, error: pe } = await client
        .from("profiles")
        .select("id,full_name,is_active")
        .eq("id", user.id)
        .maybeSingle();
      if (pe) throw pe;
      if (!profile?.is_active)
        fail("Application profile is missing or inactive.", 403);
      const { data: assignments, error: ae } = await client
        .from("role_assignments")
        .select("role_code,scope,campus_id,department_id")
        .eq("user_id", user.id);
      if (ae) throw ae;
      if (state.users.some((u) => u.id === user.id && !u.is_active))
        fail("Application access has been disabled.", 403);
      const linked = state.users.find((u) => u.id === user.id && u.staff_id);
      if (
        linked &&
        state.staff.some(
          (s) =>
            s.id === linked.staff_id &&
            (s.status !== "active" ||
              !assignments?.some((a) => a.campus_id === s.campus_id)),
        )
      )
        fail(
          "Staff appointment changed. Administrator must update scoped roles.",
          403,
        );
      actor = {
        userId: user.id,
        profile,
        assignments: assignments || [],
        email: user.email,
      };
    }
    req.actor = actor;
    next();
  });
  app.post("/api/auth/logout", (req, res) => {
    sessions.delete((req.get("authorization") || "").slice(7));
    res.json({ message: "Signed out." });
  });
  app.use("/api/documents", documentRoutes(store));
  app.get("/api/me", (req, res) =>
    res.json({ ...req.actor, modules: capabilities(req.actor) }),
  );
  app.get("/api/workspace", async (req, res) =>
    res.json(safeView(await store.read(), req.actor)),
  );
  app.get("/api/campuses", async (req, res) =>
    res.json({ campuses: safeView(await store.read(), req.actor).campuses }),
  );
  app.get("/api/departments", async (req, res) =>
    res.json({
      departments: safeView(await store.read(), req.actor).departments,
    }),
  );
  app.post("/api/import/preview", async (req, res) =>
    res.json(previewImport(await store.read(), req.actor, req.body)),
  );
  app.post("/api/actions/:action", async (req, res) => {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body))
      fail("A JSON object is required.");
    const result = await store.mutate((state) =>
      act(state, req.actor, req.params.action, req.body),
    );
    res.json(result);
  });
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "API endpoint not found." }),
  );
  app.use((err, _req, res, _next) => {
    const status = err.status || 500;
    if (status >= 500) console.error(err.message);
    res.status(status).json({
      error:
        status >= 500
          ? "Server operation failed. Check the backend terminal and setup guide."
          : err.message,
    });
  });
  return app;
}
