import { useEffect, useState } from "react";
import { apiRequest } from "./lib/api";

export default function DepartmentList() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadDepartments() {
      try {
        const result = await apiRequest("/departments", {
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setDepartments(result.departments);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err.message || "Unable to load departments.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadDepartments();

    return () => controller.abort();
  }, []);

  return (
    <section aria-labelledby="departments-title">
      <h2 id="departments-title">Departments</h2>

      {loading && <p role="status">Loading departments...</p>}

      {error && <p role="alert">{error}</p>}

      {!loading && !error && (
        <>
          <p>{departments.length} departments available to you.</p>

          {departments.length === 0 ? (
            <p>No departments available.</p>
          ) : (
            <ul>
              {departments.map((department) => (
                <li key={department.id}>
                  <strong>{department.name}</strong>
                  <br />
                  {department.campus?.name ?? "Campus unavailable"}
                  {" · "}
                  {department.code}
                  {" · "}
                  {department.is_active ? "Active" : "Inactive"}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}