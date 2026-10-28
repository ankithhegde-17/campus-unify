# Campus Unify — start here

1. Stop your OLD React and Express processes with Ctrl+C.
2. Extract this ZIP into a NEW folder. Open the folder containing this file and root package.json in VS Code.
3. Run these two commands from that folder:

```powershell
npm run setup
npm run dev
```

4. Open http://localhost:5173. Select Trust Management. Password: Demo@12345. Other stakeholder accounts are available in the login selector. All records are fictional.
5. Use docs/DEMO_SCRIPT.md to rehearse. Read docs/FEATURE_STATUS.md for honest limitations.
6. To use your actual Supabase login and persistence, follow docs/SUPABASE.md: run database/005_workspace.sql, set backend-only configuration, restart and verify. Migration 004 is NOT required. Do not rerun migrations 001–003.

No Supabase credentials, node_modules or real personal data are bundled. The demo stores changes locally. It is not silently using your live database.

Source: client/src (React), server/src (Express and domain logic), database (SQL), server/test (27 automated tests), docs (architecture, permissions, validation and setup).
