import { useEffect, useRef, useState } from "react";
import {
  X,
  Search,
  ChevronLeft,
  ChevronRight,
  Inbox,
  LoaderCircle,
} from "lucide-react";
import { label } from './lib/format';
export function Badge({ children, tone = "" }) {
  const color =
    tone ||
    (["active", "present", "approved", "received"].includes(children)
      ? "green"
      : ["pending", "application", "absent", "inactive"].includes(children)
        ? "amber"
        : "");
  return <span className={`badge ${color}`}>{label(children)}</span>;
}
export function Empty({ title = "No records yet", children }) {
  return (
    <div className="empty">
      <Inbox size={30} />
      <h3>{title}</h3>
      <p>{children || "Records will appear here when they are available."}</p>
    </div>
  );
}
export function Table({
  columns,
  rows,
  search = true,
  empty = "No matching records",
  actions,
}) {
  const [query, setQuery] = useState(""),
    [page, setPage] = useState(0);
  const filtered = rows.filter((r) =>
      JSON.stringify(r).toLowerCase().includes(query.toLowerCase()),
    ),
    pages = Math.max(1, Math.ceil(filtered.length / 8)),
    current = Math.min(page, pages - 1),
    visible = filtered.slice(current * 8, current * 8 + 8);
  return (
    <div className="table-panel">
      {(search || actions) && (
        <div className="table-toolbar">
          {search && (
            <div className="search">
              <Search size={16} />
              <input
                aria-label="Search records"
                placeholder="Search records..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                }}
              />
            </div>
          )}
          <div className="toolbar-actions">{actions}</div>
        </div>
      )}
      {filtered.length ? (
        <>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th key={c.key}>{c.title}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((r, i) => (
                  <tr key={r.id || i}>
                    {columns.map((c) => (
                      <td key={c.key}>
                        {c.render ? c.render(r) : (r[c.key] ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <span>
              Showing {current * 8 + 1}–
              {Math.min(current * 8 + 8, filtered.length)} of {filtered.length}
            </span>
            <div>
              <button
                className="icon-button"
                aria-label="Previous page"
                disabled={!current}
                onClick={() => setPage(current - 1)}
              >
                <ChevronLeft size={16} />
              </button>
              <span>
                {current + 1} / {pages}
              </span>
              <button
                className="icon-button"
                aria-label="Next page"
                disabled={current === pages - 1}
                onClick={() => setPage(current + 1)}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </>
      ) : (
        <Empty title={empty} />
      )}
    </div>
  );
}
export function Modal({ spec, onClose }) {
  const [values, setValues] = useState(spec.initial || {}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current,
      previous = document.activeElement;
    el.showModal();
    return () => {
      el.close();
      previous?.focus?.();
    };
  }, []);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await spec.submit(values);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else onClose();
      }}
      aria-labelledby="dialog-title"
    >
      <div className="modal-head">
        <div>
          <p className="eyebrow">Maharaja Education Trust</p>
          <h2 id="dialog-title">{spec.title}</h2>
        </div>
        <button
          className="icon-button"
          aria-label="Close dialog"
          disabled={busy}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {spec.description && <p className="muted">{spec.description}</p>}
      {spec.content}
      <form onSubmit={submit}>
        <div className="form-grid">
          {spec.fields
            ?.filter((f) => !f.when || f.when(values))
            .map((f) => {
              const options =
                typeof f.options === "function" ? f.options(values) : f.options;
              return (
                <div key={f.key} className={f.wide ? "wide" : ""}>
                  <label htmlFor={`field-${f.key}`}>{f.label}</label>
                  {f.type === "select" ? (
                    <select
                      id={`field-${f.key}`}
                      required={f.required !== false}
                      value={values[f.key] ?? ""}
                      onChange={(e) =>
                        setValues({
                          ...values,
                          [f.key]: e.target.value,
                          ...(f.reset
                            ? Object.fromEntries(f.reset.map((k) => [k, ""]))
                            : {}),
                        })
                      }
                    >
                      <option value="">Select an option</option>
                      {options?.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : f.type === "textarea" ? (
                    <textarea
                      id={`field-${f.key}`}
                      rows={3}
                      required={f.required !== false}
                      maxLength={f.max || 2000}
                      value={values[f.key] ?? ""}
                      onChange={(e) =>
                        setValues({ ...values, [f.key]: e.target.value })
                      }
                    />
                  ) : (
                    <input
                      id={`field-${f.key}`}
                      type={f.type || "text"}
                      min={f.min}
                      max={f.max}
                      step={f.type === "number" ? "0.01" : undefined}
                      required={f.required !== false}
                      value={values[f.key] ?? ""}
                      onChange={(e) =>
                        setValues({ ...values, [f.key]: e.target.value })
                      }
                    />
                  )}
                </div>
              );
            })}
        </div>
        {error && (
          <p className="alert error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-footer">
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={onClose}
          >
            Close
          </button>
          {spec.submit && (
            <button className="button" disabled={busy}>
              {busy ? <LoaderCircle className="spin" size={16} /> : null}
              {busy ? "Saving..." : spec.button || "Save changes"}
            </button>
          )}
        </div>
      </form>
    </dialog>
  );
}
export function Panel({ title, subtitle, children, action }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
