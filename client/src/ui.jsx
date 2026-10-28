import { useEffect, useRef, useState } from "react";
import {
  X,
  Search,
  ChevronLeft,
  ChevronRight,
  Inbox,
  LoaderCircle,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
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
export function Empty({ title = "No records yet", children, action }) {
  return (
    <div className="empty">
      <Inbox size={26} />
      <p className="empty-title">{title}</p>
      <p>{children || "Records will appear here when they are available."}</p>
      {action}
    </div>
  );
}
const sortable = (v) => ["string", "number", "boolean"].includes(typeof v);
function compare(a, b) {
  if (a == null) return b == null ? 0 : 1;
  if (b == null) return -1;
  return typeof a === "number" && typeof b === "number"
    ? a - b
    : String(a).localeCompare(String(b), undefined, { numeric: true });
}
export function Table({
  columns,
  rows,
  search = true,
  empty = "No matching records",
  actions,
}) {
  const [query, setQuery] = useState(""),
    [page, setPage] = useState(0),
    [sort, setSort] = useState(null);
  const matches = rows.filter((r) =>
      JSON.stringify(r).toLowerCase().includes(query.toLowerCase()),
    ),
    filtered = sort
      ? [...matches].sort(
          (a, b) => compare(a[sort.key], b[sort.key]) * sort.dir,
        )
      : matches,
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
              {query && (
                <button
                  className="icon-button"
                  aria-label="Clear search"
                  onClick={() => setQuery("")}
                >
                  <X size={14} />
                </button>
              )}
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
                  {columns.map((c) => {
                    if (!rows.some((r) => sortable(r[c.key])))
                      return <th key={c.key}>{c.title}</th>;
                    const active = sort?.key === c.key,
                      Icon = !active
                        ? ArrowUpDown
                        : sort.dir > 0
                          ? ArrowUp
                          : ArrowDown;
                    return (
                      <th
                        key={c.key}
                        aria-sort={
                          active
                            ? sort.dir > 0
                              ? "ascending"
                              : "descending"
                            : undefined
                        }
                      >
                        <button
                          type="button"
                          className="sort"
                          onClick={() => {
                            // Cycle: ascending → descending → original order.
                            setSort(
                              !active
                                ? { key: c.key, dir: 1 }
                                : sort.dir > 0
                                  ? { key: c.key, dir: -1 }
                                  : null,
                            );
                            setPage(0);
                          }}
                        >
                          {c.title}
                          <Icon size={12} />
                        </button>
                      </th>
                    );
                  })}
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
        <Empty
          title={empty}
          action={
            query && (
              <button className="small-button" onClick={() => setQuery("")}>
                <X size={13} />
                Clear search
              </button>
            )
          }
        >
          {query ? `Nothing matches “${query}”.` : undefined}
        </Empty>
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
      onClick={(e) => {
        // Close only for clicks on the backdrop, not the dialog's own padding.
        if (e.target !== ref.current || busy) return;
        const box = ref.current.getBoundingClientRect();
        if (
          e.clientX < box.left ||
          e.clientX > box.right ||
          e.clientY < box.top ||
          e.clientY > box.bottom
        )
          onClose();
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
            {spec.submit ? "Cancel" : "Close"}
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
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
