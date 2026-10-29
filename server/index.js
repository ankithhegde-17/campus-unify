// Vercel entrypoint: exports the Express app instead of listening on a port.
// Local development still starts from src/index.js.
import express from "express";
import { createStore } from "./src/store.js";
import { createApp } from "./src/app.js";

const entry = express();
// The API's routes live under /api. Accept requests whether or not the
// platform strips that prefix before forwarding to this service.
entry.use((req, _res, next) => {
  if (req.url !== "/api" && !req.url.startsWith("/api/")) req.url = `/api${req.url}`;
  next();
});

// Startup loads the whole workspace from Supabase. If that fails (for example
// a statement timeout while the database is busy), the next request tries
// again instead of this instance reporting the failure until it is recycled.
let ready = null;
function start() {
  ready ||= (async () => {
    // Demo mode keeps sessions in memory and writes a local file; neither
    // survives on serverless functions.
    if ((process.env.APP_MODE || "demo") !== "supabase")
      throw new Error(
        "APP_MODE must be 'supabase' on Vercel. Add APP_MODE and the SUPABASE_* variables in Project Settings → Environment Variables, then redeploy.",
      );
    return createApp(await createStore());
  })().catch((error) => {
    ready = null;
    throw error;
  });
  return ready;
}
start().catch((error) => console.error("Startup failed:", error.message));

entry.use(async (req, res, next) => {
  let app;
  try {
    app = await start();
  } catch (error) {
    // Report the startup failure as JSON so the sign-in screen can show it.
    console.error("Startup failed:", error.message);
    return res
      .status(503)
      .json({ error: `Server failed to start: ${error.message}. Refresh to try again.` });
  }
  app(req, res, next);
});

export default entry;
