import { spawnSync } from "node:child_process";
for (const folder of ["server", "client"]) {
  const r = spawnSync(
    process.execPath,
    [process.env.npm_execpath, "--prefix", folder, "ci"],
    { stdio: "inherit" },
  );
  if (r.status !== 0) process.exit(r.status || 1);
}
console.log("\nReady. Run npm run dev from the campus-unify folder.");
