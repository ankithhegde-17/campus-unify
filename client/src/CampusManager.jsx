import { useEffect, useState } from "react";
import { apiRequest } from "./lib/api";

export default function CampusManager({ canCreate }) {
  const [campuses, setCampuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [institutionType, setInstitutionType] = useState("engineering");

  useEffect(() => {
    const controller = new AbortController();

    async function loadCampuses() {
      try {
        const result = await apiRequest("/campuses", {
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setCampuses(result.campuses);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err.message || "Unable to load campuses.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadCampuses();

    return () => controller.abort();
  }, []);

  async function handleCreate(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const result = await apiRequest("/campuses", {
        method: "POST",
        body: JSON.stringify({
          code,
          name,
          institution_type: institutionType,
        }),
      });

      setCampuses((current) =>
        [...current, result.campus].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      );

      setCode("");
      setName("");
      setNotice(`${result.campus.name} was created successfully.`);
    } catch (err) {
      setError(err.message || "Unable to create campus.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="campuses-title">
      <h2 id="campuses-title">Campuses</h2>

      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}

      {loading ? (
        <p role="status">Loading campuses...</p>
      ) : (
        <>
          <p>{campuses.length} campus records available to you.</p>

          {campuses.length === 0 ? (
            <p>No campuses available.</p>
          ) : (
            <ul>
              {campuses.map((campus) => (
                <li key={campus.id}>
                  <strong>{campus.name}</strong>
                  <br />
                  {campus.code} · {campus.institution_type}
                  {" · "}
                  {campus.is_active ? "Active" : "Inactive"}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {canCreate && (
        <>
          <h3>Add a campus</h3>

          <form onSubmit={handleCreate}>
            <label htmlFor="campus-code">Campus code</label>
            <input
              id="campus-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="CAMPUS-A"
              maxLength={30}
              pattern="[A-Za-z0-9_-]+"
              required
              disabled={saving}
            />

            <label htmlFor="campus-name">Campus name</label>
            <input
              id="campus-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Enter the institution name"
              maxLength={200}
              required
              disabled={saving}
            />

            <label htmlFor="institution-type">Institution type</label>
            <select
              id="institution-type"
              value={institutionType}
              onChange={(event) =>
                setInstitutionType(event.target.value)
              }
              disabled={saving}
            >
              <option value="engineering">Engineering</option>
              <option value="polytechnic">Polytechnic</option>
              <option value="school">School</option>
              <option value="other">Other</option>
            </select>

            <button type="submit" disabled={saving}>
              {saving ? "Creating..." : "Create campus"}
            </button>
          </form>
        </>
      )}
    </section>
  );
}