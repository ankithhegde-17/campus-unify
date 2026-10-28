// Vercel entrypoint: exports the Express app instead of listening on a port.
// Local development still starts from src/index.js.
import express from "express";
import { createStore } from "./src/store.js";
import { createApp } from "./src/app.js";

const app = createApp(await createStore()),
  entry = express();
// The API's routes live under /api. Accept requests whether or not the
// platform strips that prefix before forwarding to this service.
entry.use((req, _res, next) => {
  if (req.url !== "/api" && !req.url.startsWith("/api/")) req.url = `/api${req.url}`;
  next();
});
entry.use(app);

export default entry;
