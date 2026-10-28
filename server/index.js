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

try {
  // Demo mode keeps sessions in memory and writes a local file; neither
  // survives on serverless functions.
  if ((process.env.APP_MODE || "demo") !== "supabase")
    throw new Error(
      "APP_MODE must be 'supabase' on Vercel. Add APP_MODE and the SUPABASE_* variables in Project Settings → Environment Variables, then redeploy.",
    );
  entry.use(createApp(await createStore()));
} catch (error) {
  // Report the startup failure as JSON so the sign-in screen can show it.
  console.error("Startup failed:", error.message);
  entry.use((_req, res) =>
    res.status(503).json({ error: `Server failed to start: ${error.message}` }),
  );
}

export default entry;
