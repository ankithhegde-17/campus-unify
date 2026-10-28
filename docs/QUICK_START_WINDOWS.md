# Start in a few minutes

1. Stop the OLD frontend and backend with Ctrl+C in their terminals.
2. Extract the delivered ZIP into a NEW folder, for example D:\Hackmitten\campus-unify-ready. Do not overwrite your original project or copy old environment files yet.
3. Open the extracted folder containing README.md and the root package.json in VS Code.
4. Open Terminal → New Terminal. Run:

```powershell
npm run setup
npm run dev
```

5. Open http://localhost:5173. Choose Trust Management and sign in with the prefilled demo credentials. All data is fictional and generated automatically; there is no need to create six campuses manually.
6. Sign out and choose another role to demonstrate access boundaries.

Node 24 and npm are already installed on your computer. npm run setup needs internet access to install dependencies. After setup, demo operation needs no external service.

## Where commands run

The command prompt must point to the folder with ROOT package.json, client, server and database. Unlike the old starter, this ZIP includes a root package.json, so root npm run setup/dev/test/build commands are intentional.

## Port errors

If 5000 or 5173 is in use, stop your old terminals. Vite deliberately does not silently move to another port. Do not start several copies of npm run dev.

## Unexpected JSON or API errors

- GET http://localhost:5000/api/health should return JSON with mode demo.
- /api/workspace without a token should return 401 JSON.
- Confirm both services started in the terminal and the browser uses port 5173.
- A restarted demo server invalidates its in-memory login sessions. Sign out and sign back in.
- If an old .env says APP_MODE=supabase without full credentials, remove that file from the NEW copy or set APP_MODE=demo.

## Reset only your fictional local demo

Stop both services. Back up server/data/workspace.json if needed. Delete that generated file and restart to create a fresh sample. This clears local demo changes only. Do not delete or reset your Supabase workspace.

## Supabase later

Read docs/SUPABASE.md. Migration 005 and backend configuration are the only required additions to the foundation you already ran. The uncertain migration 004 is not required for this prototype.
