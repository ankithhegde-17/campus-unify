import { spawn } from "node:child_process";
const children = ["server", "client"].map((folder) =>
  spawn(
    process.execPath,
    [process.env.npm_execpath, "--prefix", folder, "run", "dev"],
    { stdio: "inherit", env: process.env },
  ),
);
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
for (const child of children)
  child.on("exit", (code) => {
    if (!stopping) {
      stop();
      process.exitCode = code || 0;
    }
  });
console.log(
  "Campus Unify: open http://localhost:5173 · Ctrl+C stops both servers.",
);
