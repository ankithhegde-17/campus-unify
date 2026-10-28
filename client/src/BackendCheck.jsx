import { useState } from "react";
import { supabase } from "./lib/supabaseClient";

export default function BackendCheck() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function checkBackend() {
    setBusy(true);
    setMessage("");

    try {
      const { data, error } = await supabase.auth.getSession();

      if (error) throw error;

      const token = data.session?.access_token;

      if (!token) {
        throw new Error("Please sign in first.");
      }

      const response = await fetch("/api/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Backend request failed.");
      }

      const roles = result.assignments
        .map((assignment) => assignment.role_code.replaceAll("_", " "))
        .join(", ");

      setMessage(
        `Backend verified: ${result.profile.full_name}. ` +
        `Roles: ${roles || "No active roles"}.`
      );
    } catch (error) {
      setMessage(error.message || "Unable to reach the backend.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="backend-check-title">
      <h3 id="backend-check-title">Protected backend connection</h3>

      <button type="button" onClick={checkBackend} disabled={busy}>
        {busy ? "Checking..." : "Check backend access"}
      </button>

      <p role="status">{message}</p>
    </section>
  );
}