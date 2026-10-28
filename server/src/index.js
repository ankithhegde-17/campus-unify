import { createStore } from "./store.js";
import { createApp } from "./app.js";
const store = await createStore();
const port = Number(process.env.PORT || 5050);
createApp(store).listen(port, "127.0.0.1", () =>
  console.log(
    `Campus Unify API: http://localhost:${port} | ${store.mode} mode`,
  ),
);
