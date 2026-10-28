import { createClient } from "@supabase/supabase-js";
export let authClient = null;
export function configure(config) {
  if (config.mode === "supabase") {
    if (!config.supabaseUrl || !config.publishableKey)
      throw new Error("Backend Supabase configuration is incomplete.");
    authClient = createClient(config.supabaseUrl, config.publishableKey);
  }
}
export async function api(path, options = {}) {
  let token = sessionStorage.getItem("cu.demo.token");
  if (authClient) {
    const { data, error } = await authClient.auth.getSession();
    if (error) throw error;
    token = data.session?.access_token;
  }
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const raw = await response.text();
  let result;
  try {
    result = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(
      `The API returned a non-JSON response (${response.status}). Check Express and the Vite /api proxy.`,
    );
  }
  if (!response.ok)
    throw new Error(result.error || `Request failed (${response.status}).`);
  return result;
}
export function download(name, content, type = "text/csv") {
  const blob = new Blob([content], { type }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function csv(rows) {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  const cell = (x) =>
    `"${String(x ?? "")
      .replace(/^[=+@-]/, "'$&")
      .replaceAll('"', '""')}"`;
  return [keys, ...rows.map((r) => keys.map((k) => r[k]))]
    .map((r) => r.map(cell).join(","))
    .join("\r\n");
}
export function parseCSV(text) {
  const rows = [];
  let row = [],
    value = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(value);
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
      value = "";
    } else value += c;
  }
  if (quoted) throw new Error("CSV contains an unclosed quote.");
  row.push(value);
  if (row.some((x) => x.trim())) rows.push(row);
  const headers = rows.shift()?.map((x) => x.trim().replace(/^\uFEFF/, ""));
  if (!headers?.includes("full_name") || !headers.includes("student_code"))
    throw new Error("CSV needs full_name and student_code headers.");
  if (rows.some((r) => r.length !== headers.length))
    throw new Error(
      "CSV rows must have the same number of columns as the header.",
    );
  return rows.map((r) =>
    Object.fromEntries(headers.map((h, i) => [h, r[i]?.trim() || ""])),
  );
}
