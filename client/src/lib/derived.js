// Lookups built once per dataset. Pages list every student in scope, so
// scanning charges, payments and attendance per student would be quadratic.
const lookups = new WeakMap();
const today = () => new Date().toISOString().slice(0, 10);
function group(rows, key) {
  const map = new Map();
  for (const r of rows) {
    const k = key(r);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(r);
  }
  return map;
}
const classKey = (x) => `${x?.campus_id}|${x?.department_id}|${x?.class_name}`;
export function lookup(d) {
  let x = lookups.get(d);
  if (x) return x;
  x = {
    students: new Map(d.students.map((s) => [s.id, s])),
    campuses: new Map(d.campuses.map((c) => [c.id, c])),
    sessions: new Map(d.sessions.map((s) => [s.id, s])),
    classSessions: group(d.sessions, classKey),
    attendance: group(d.attendance, (a) => a.student_id),
    balances: new Map(),
    thresholds: new Map(),
    stats: new Map(),
    derived: new Map(),
  };
  for (const c of d.charges)
    x.balances.set(
      c.student_id,
      (x.balances.get(c.student_id) || 0) + c.amount - c.concession,
    );
  for (const p of d.payments)
    x.balances.set(p.student_id, (x.balances.get(p.student_id) || 0) - p.amount);
  lookups.set(d, x);
  return x;
}
// Values derived from a whole dataset (table rows, totals) are kept with it,
// so returning to a page reuses them instead of rebuilding 14k rows.
export function derive(d, key, build) {
  const cache = lookup(d).derived;
  if (!cache.has(key)) cache.set(key, build());
  return cache.get(key);
}
export function studentBalance(d, id) {
  return lookup(d).balances.get(id) || 0;
}
export function attendanceStats(d, id) {
  const x = lookup(d);
  if (!x.stats.has(id)) x.stats.set(id, computeStats(x, id));
  return x.stats.get(id);
}
function computeStats(x, id) {
  const sessions = x.classSessions.get(classKey(x.students.get(id))) || [];
  const ids = sessionIds(x, sessions);
  const entries = (x.attendance.get(id) || []).filter((a) =>
    ids.has(a.session_id),
  );
  const counted = entries.filter((a) => a.status !== "excused"),
    present = counted.filter((a) => a.status === "present").length;
  return {
    present,
    total: counted.length,
    missing: Math.max(0, sessions.length - entries.length),
    percent: counted.length
      ? Math.round((present / counted.length) * 100)
      : null,
  };
}
function sessionIds(x, sessions) {
  x.sessionIds ||= new WeakMap();
  if (!x.sessionIds.has(sessions))
    x.sessionIds.set(sessions, new Set(sessions.map((s) => s.id)));
  return x.sessionIds.get(sessions);
}
export const feeRows = (d) =>
  derive(d, "feeRows", () =>
    d.students.map((s) => ({ ...s, balance: studentBalance(d, s.id) })),
  );
export const eligibilityRows = (d) =>
  derive(d, "eligibilityRows", () =>
    d.students.map((s) => ({
      ...s,
      ...attendanceStats(d, s.id),
      threshold: threshold(d, s.campus_id),
    })),
  );
export const attendanceRisks = (d) =>
  derive(d, "risks", () =>
    d.students.filter((s) => {
      const a = attendanceStats(d, s.id);
      return a.percent !== null && a.percent < threshold(d, s.campus_id);
    }),
  );
// Builds the Fees and Attendance tables in idle time after data loads, so
// the first visit to either page is as quick as later ones.
export function prepareData(d) {
  const steps = [feeRows, attendanceRisks, eligibilityRows],
    idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 50));
  let cancelled = false;
  (function next() {
    idle(() => {
      if (cancelled || !steps.length) return;
      steps.shift()(d);
      next();
    });
  })();
  return () => (cancelled = true);
}
export function threshold(d, campus) {
  const cache = lookup(d).thresholds;
  if (!cache.has(campus))
    cache.set(
      campus,
      [...d.rules]
        .filter((r) => r.campus_id === campus && r.effective_from <= today())
        .sort(
          (a, b) =>
            b.effective_from.localeCompare(a.effective_from) ||
            b.version - a.version,
        )[0]?.attendance_threshold ?? 75,
    );
  return cache.get(campus);
}
