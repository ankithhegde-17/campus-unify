import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { makeSeed } from "./domain/seed.js";
export async function createStore(options = {}) {
  const mode = options.mode || process.env.APP_MODE || "demo";
  if (!["demo", "supabase"].includes(mode))
    throw new Error("APP_MODE must be demo or supabase.");
  const file =
    options.file ||
    process.env.DEMO_DATA_FILE ||
    fileURLToPath(new URL("../data/workspace.json", import.meta.url));
  let state,
    revision = 0,
    admin;
  if (mode === "supabase") {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY)
      throw new Error(
        "Supabase mode needs SUPABASE_URL and backend-only SUPABASE_SECRET_KEY. Run database/005_workspace.sql first.",
      );
    admin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SECRET_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data, error } = await admin
      .from("cu_workspace")
      .select("payload,revision")
      .eq("id", "main")
      .maybeSingle();
    if (error)
      throw new Error(`Run database/005_workspace.sql: ${error.message}`);
    if (data) {
      state = data.payload;
      revision = data.revision;
    } else {
      const { data: campuses, error: ce } = await admin
        .from("campuses")
        .select("*");
      if (ce) throw ce;
      const { data: departments, error: de } = await admin
        .from("departments")
        .select("*");
      if (de) throw de;
      state = makeSeed(campuses || [], departments || []);
      for (const c of state.campuses) {
        const { error } = await admin
          .from("campuses")
          .upsert(c, { onConflict: "code" });
        if (error) throw error;
      }
      for (const d of state.departments) {
        const { error } = await admin
          .from("departments")
          .upsert(d, { onConflict: "campus_id,code" });
        if (error) throw error;
      }
      const { error: e } = await admin
        .from("cu_workspace")
        .insert({ id: "main", payload: state, revision: 0 });
      if (e) throw e;
    }
  } else {
    try {
      state = JSON.parse(await readFile(file, "utf8"));
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
      state = makeSeed();
      await mkdir(fileURLToPath(new URL("../data/", import.meta.url)), {
        recursive: true,
      });
      await writeFile(file, JSON.stringify(state, null, 2));
    }
  }
  let queue = Promise.resolve();
  async function reload() {
    if (admin) {
      const { data, error } = await admin
        .from("cu_workspace")
        .select("payload,revision")
        .eq("id", "main")
        .single();
      if (error) throw error;
      state = data.payload;
      revision = data.revision;
    }
    return state;
  }
  return {
    mode,
    admin,
    read: reload,
    async mutate(operation) {
      const task = queue.then(async () => {
        await reload();
        const draft = structuredClone(state);
        const result = await operation(draft);
        if (admin) {
          const { data, error } = await admin.rpc("cu_save_workspace", {
            expected_revision: revision,
            next_payload: draft,
          });
          if (error) throw error;
          if (data === null)
            throw Object.assign(
              new Error(
                "Another request changed the workspace. Refresh and retry.",
              ),
              { status: 409 },
            );
          revision = data;
        } else {
          await writeFile(`${file}.tmp`, JSON.stringify(draft, null, 2));
          await rename(`${file}.tmp`, file);
        }
        state = draft;
        return result;
      });
      queue = task.catch(() => {});
      return task;
    },
  };
}
