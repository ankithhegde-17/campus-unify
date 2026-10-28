import { useEffect, useState } from "react";
import {
  Activity,
  LayoutDashboard,
  Users,
  GraduationCap,
  Wallet,
  ClipboardCheck,
  BedDouble,
  Settings2,
  Upload,
  ChartNoAxesCombined,
  Bell,
  ShieldCheck,
  LogOut,
  Search,
  ChevronDown,
  ArrowUpRight,
  Menu,
  X,
  LoaderCircle,
  Building2,
  CircleHelp,
  CheckCircle2,
  RefreshCw,
  FileCheck2,
} from "lucide-react";
import { configure, authClient, api } from "./lib/client";
import { Modal } from "./ui";
import { label } from "./lib/format";
import {
  Overview,
  Students,
  Staff,
  Finance,
  Attendance,
  Hostels,
  Rules,
  Approvals,
  Scholarships,
  Reports,
  Notices,
  Audit,
  UsersPage,
  Imports,
} from "./pages";
const pages = {
  overview: Overview,
  students: Students,
  staff: Staff,
  finance: Finance,
  attendance: Attendance,
  hostels: Hostels,
  rules: Rules,
  approvals: Approvals,
  scholarships: Scholarships,
  reports: Reports,
  notices: Notices,
  audit: Audit,
  users: UsersPage,
  imports: Imports,
};
import "./App.css";
const roles = [
  "trust_management",
  "campus_admin",
  "admissions_officer",
  "accounts_officer",
  "hod",
  "faculty",
  "warden",
  "student",
  "parent",
  "system_admin",
  "auditor",
];
const nav = {
  overview: ["Overview", LayoutDashboard],
  students: ["Students & admissions", GraduationCap],
  staff: ["Faculty & staff", Users],
  finance: ["Fees & receipts", Wallet],
  attendance: ["Attendance", ClipboardCheck],
  hostels: ["Hostels", BedDouble],
  scholarships: ["Scholarships", FileCheck2],
  approvals: ["Requests & approvals", CheckCircle2],
  rules: ["Campus rules", Settings2],
  imports: ["Import & data quality", Upload],
  reports: ["Reports", ChartNoAxesCombined],
  notices: ["Announcements", Bell],
  users: ["Account access", ShieldCheck],
  audit: ["Audit trail", Activity],
};
const descriptions = {
  overview: "Your daily view of people, finances and campus operations.",
  students: "One student identity. Connected admissions and enrolments.",
  staff: "Manage faculty, department leadership and campus appointments.",
  finance: "Accurate balances. Traceable collections. Preserved receipts.",
  attendance: "Class registers, eligibility and reviewed corrections.",
  hostels: "Rooms, residents and reliable bed availability.",
  scholarships: "Track support from application to received reimbursement.",
  approvals: "Every important change has a reason and a reviewer.",
  rules: "Configure local differences without changing the code.",
  imports: "Bring scattered spreadsheets into one reliable student register.",
  reports: "Consolidated information with consistent campus boundaries.",
  notices: "Keep the right people informed.",
  audit: "A record of significant actions and decisions.",
  users: "Manage application access without exposing student records.",
};

function Login({ config, onSignedIn }) {
  const [email, setEmail] = useState(
      config.mode === "demo" ? "trust_management@demo.local" : "",
    ),
    [password, setPassword] = useState(
      config.mode === "demo" ? "Demo@12345" : "",
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (config.mode === "demo") {
        const result = await api("/auth/demo", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        sessionStorage.setItem("cu.demo.token", result.token);
      } else {
        const { error } = await authClient.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }
      onSignedIn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <section className="login-story">
        <div className="brand">
          <span className="brand-logo">
            <Building2 size={24} />
          </span>
          <strong>
            campus<span>unify</span>
          </strong>
        </div>
        <div className="login-copy">
          <p className="eyebrow">ONE TRUST. EVERY CAMPUS.</p>
          <h1>
            Less scattered.
            <br />
            More connected.
          </h1>
          <p>
            Bring your students, people and campus operations together in one
            thoughtful workspace.
          </p>
          <div className="story-lines">
            <span>
              <CheckCircle2 size={18} />A single student identity
            </span>
            <span>
              <CheckCircle2 size={18} />
              Local rules, shared clarity
            </span>
            <span>
              <CheckCircle2 size={18} />
              The right access for every role
            </span>
          </div>
        </div>
        <footer>
          Built for educational institutions. Designed around people.
        </footer>
      </section>
      <section className="login-side">
        <div className="login-form">
          <span className="pill">
            {config.mode === "demo"
              ? "SYNTHETIC DEMONSTRATION"
              : "SECURE INSTITUTIONAL ACCESS"}
          </span>
          <h2>Welcome back.</h2>
          <p>Sign in to your Campus Unify workspace.</p>
          <form onSubmit={submit}>
            {config.mode === "demo" && (
              <label>
                Choose a demo stakeholder
                <select
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                >
                  {roles.map((r) => (
                    <option key={r} value={`${r}@demo.local`}>
                      {label(r)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Email address
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
              />
            </label>
            {error && (
              <p className="alert error" role="alert">
                {error}
              </p>
            )}
            <button className="button login-submit" disabled={busy}>
              {busy ? <LoaderCircle size={17} className="spin" /> : null}
              {busy ? "Signing in..." : "Sign in to workspace"}
              <ArrowUpRight size={18} />
            </button>
          </form>
          {config.mode === "demo" ? (
            <p className="login-note">
              Demo password: <code>Demo@12345</code>
              <br />
              Fictional data only. Each account has server-enforced permissions.
            </p>
          ) : (
            <p className="login-note">
              Use your assigned account. Contact your administrator for access.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
function scoped(data, campus) {
  if (!campus) return data;
  const result = { ...data };
  for (const key of [
    "campuses",
    "departments",
    "students",
    "staff",
    "rules",
    "charges",
    "payments",
    "sessions",
    "attendance",
    "beds",
    "allocations",
    "scholarships",
    "requests",
    "imports",
    "report_rows",
  ])
    result[key] = data[key].filter((x) =>
      key === "campuses" ? x.id === campus : x.campus_id === campus,
    );
  result.notices = data.notices.filter(
    (n) => !n.campus_id || n.campus_id === campus,
  );
  result.audit = data.audit.filter(
    (a) => !a.campus_id || a.campus_id === campus,
  );
  return result;
}
function Workspace({ config, onSignedOut }) {
  const [data, setData] = useState(null),
    [page, setPage] = useState("overview"),
    [campus, setCampus] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [modal, setModal] = useState(null),
    [mobile, setMobile] = useState(false),
    [query, setQuery] = useState(""),
    [refreshing, setRefreshing] = useState(false);
  async function load() {
    const result = await api("/workspace");
    setData(result);
    return result;
  }
  useEffect(() => {
    let ignore = false;
    api("/workspace")
      .then((d) => {
        if (!ignore) setData(d);
      })
      .catch((e) => {
        if (!ignore) setError(e.message);
      });
    return () => {
      ignore = true;
    };
  }, []);
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(""), 6500);
      return () => clearTimeout(timer);
    }
  }, [notice]);
  async function run(action, body) {
    try {
      const result = await api(`/actions/${action}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      await load();
      setNotice(result.message);
      setError("");
      return result;
    } catch (e) {
      setError(e.message);
      throw e;
    }
  }
  async function logout() {
    if (config.mode === "demo") {
      // A restarted backend may already have forgotten this session.
      // Always allow the browser to clear its expired local credential.
      try {
        await api("/auth/logout", { method: "POST", body: "{}" });
      } catch {
        /* The local sign-out must still complete. */
      }
      sessionStorage.removeItem("cu.demo.token");
      onSignedOut();
      return;
    }
    try {
      const { error } = await authClient.auth.signOut();
      if (error) throw error;
      onSignedOut();
    } catch (e) {
      setError(e.message);
    }
  }
  async function refresh() {
    setRefreshing(true);
    try {
      await load();
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setRefreshing(false);
    }
  }
  if (!data)
    return (
      <div className="boot">
        <Building2 size={36} />
        <h2>
          {error ? "Unable to open workspace" : "Opening your workspace..."}
        </h2>
        {error && (
          <>
            <p role="alert">{error}</p>
            <button className="button" onClick={logout}>
              Back to sign in
            </button>
          </>
        )}
      </div>
    );
  const d = scoped(data, campus),
    Page = pages[page] || pages.overview,
    role = data.assignments[0]?.role_code || "unassigned",
    pending = data.requests.filter((r) => r.status === "pending").length;
  const results = query
    ? [
        ...d.students.map((s) => ({ ...s, kind: "Student" })),
        ...d.staff.map((s) => ({ ...s, kind: "Staff" })),
      ]
        .filter((r) => r.full_name.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 5)
    : [];
  function help() {
    setModal({
      title: "Your workspace",
      content: (
        <div className="help-content">
          <p>
            Use the sidebar to open the modules assigned to your account. Campus
            selection filters only your already-authorized records.
          </p>
          <p>
            <strong>Demo:</strong> Sign out to try another stakeholder. Changes
            persist in the backend data file, not in the browser.
          </p>
          <p>
            <strong>Approvals:</strong> Requesters cannot decide their own
            requests. Use a different authorized account for review.
          </p>
          <p>
            <strong>Receipts:</strong> Payment entries cannot be edited.
            Approved reversals create linked negative entries.
          </p>
          <p>
            <strong>Sample data:</strong> 72 fictional students and 18 staff.
            Not a measured 14,000-student deployment.
          </p>
        </div>
      ),
    });
  }
  return (
    <div className="app-shell">
      {mobile && (
        <button
          className="sidebar-overlay"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? "visible" : ""}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("overview");
          }}
        >
          <span className="brand-logo">
            <Building2 size={22} />
          </span>
          <strong>
            campus<span>unify</span>
          </strong>
        </a>
        <div className="workspace-label">
          <span className="workspace-dot" />
          <div>
            <strong>Educational Trust</strong>
            <small>Institution workspace</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <p className="nav-caption">WORKSPACE</p>
        <nav>
          {Object.entries(nav)
            .filter(([key]) => data.modules.includes(key))
            .map(([key, [title, Icon]]) => (
              <button
                key={key}
                className={`nav-item ${page === key ? "active" : ""}`}
                onClick={() => {
                  setPage(key);
                  setMobile(false);
                  setError("");
                }}
              >
                <Icon size={18} />
                <span>{title}</span>
                {key === "approvals" && pending > 0 && <b>{pending}</b>}
              </button>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="scope-note">
            <ShieldCheck size={20} />
            <strong>Your access is scoped</strong>
            <p>Only the records relevant to your responsibilities.</p>
          </div>
          <button className="nav-item" onClick={help}>
            <CircleHelp size={18} />
            <span>Help & demo guide</span>
          </button>
          <button className="nav-item" onClick={logout}>
            <LogOut size={18} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Open navigation"
            onClick={() => setMobile(true)}
          >
            <Menu size={22} />
          </button>
          <div className="global-search">
            <Search size={17} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Find a student or staff member"
              placeholder="Find a student or staff member..."
            />
            {query && (
              <div className="search-results">
                {results.length ? (
                  results.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => {
                        setQuery("");
                        setModal({
                          title: r.full_name,
                          content: (
                            <dl className="details">
                              {Object.entries(r)
                                .filter(
                                  ([k]) => !k.endsWith("_id") && k !== "id",
                                )
                                .map(([k, v]) => (
                                  <div key={k}>
                                    <dt>{label(k)}</dt>
                                    <dd>{String(v ?? "—")}</dd>
                                  </div>
                                ))}
                            </dl>
                          ),
                        });
                      }}
                    >
                      <span className="avatar small">{r.full_name[0]}</span>
                      <div>
                        <strong>{r.full_name}</strong>
                        <small>
                          {r.kind} · {r.student_code || r.staff_code}
                        </small>
                      </div>
                    </button>
                  ))
                ) : (
                  <p>No authorized matches.</p>
                )}
              </div>
            )}
          </div>
          <div className="topbar-right">
            <span className="environment">
              <i />
              {config.mode === "demo" ? "Demo workspace" : "Supabase connected"}
            </span>
            <button
              className="icon-button"
              aria-label="Announcements"
              onClick={() =>
                data.modules.includes("notices") && setPage("notices")
              }
            >
              <Bell size={19} />
            </button>
            <span className="topbar-divider" />
            <span className="avatar dark">
              {data.profile.full_name
                .split(" ")
                .map((s) => s[0])
                .slice(0, 2)
                .join("")}
            </span>
            <div className="profile-summary">
              <strong>{data.profile.full_name}</strong>
              <small>{label(role)}</small>
            </div>
          </div>
        </header>
        <main className="content">
          <div className="breadcrumb">
            Workspace <ChevronRightIcon /> <span>{nav[page]?.[0]}</span>
          </div>
          <div className="page-heading">
            <div>
              <h1>{nav[page]?.[0]}</h1>
              <p>{descriptions[page]}</p>
            </div>
            <div className="heading-actions">
              <select
                aria-label="Filter by campus"
                value={campus}
                onChange={(e) => {
                  setCampus(e.target.value);
                  setQuery("");
                }}
              >
                <option value="">All authorized campuses</option>
                {data.campuses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                className="icon-button refresh"
                aria-label="Refresh data"
                disabled={refreshing}
                onClick={refresh}
              >
                <RefreshCw size={17} className={refreshing ? "spin" : ""} />
              </button>
            </div>
          </div>
          {notice && (
            <div className="toast" role="status">
              <CheckCircle2 size={19} />
              {notice}
              <button
                className="icon-button"
                aria-label="Dismiss message"
                onClick={() => setNotice("")}
              >
                <X size={15} />
              </button>
            </div>
          )}
          {error && (
            <div className="alert error" role="alert">
              {error}
            </div>
          )}
          <Page
            key={`${page}:${campus}`}
            d={d}
            all={data}
            open={setModal}
            run={run}
            reload={refresh}
            setPage={setPage}
          />
          <footer className="content-footer">
            <span>Campus Unify · One trust, every campus</span>
            <span>
              {data.meta.synthetic
                ? "Fictional demo dataset"
                : "Institution workspace"}{" "}
              ·{" "}
              {config.mode === "demo"
                ? "Local persistence"
                : "Supabase persistence"}
            </span>
          </footer>
        </main>
      </div>
      {modal && <Modal spec={modal} onClose={() => setModal(null)} />}
    </div>
  );
}
function ChevronRightIcon() {
  return <span className="crumb-divider">/</span>;
}
export default function App() {
  const [config, setConfig] = useState(null),
    [signed, setSigned] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true,
      subscription;
    async function boot() {
      try {
        const c = await api("/config");
        configure(c);
        if (!active) return;
        setConfig(c);
        if (c.mode === "demo")
          setSigned(Boolean(sessionStorage.getItem("cu.demo.token")));
        else {
          const { data } = await authClient.auth.getSession();
          if (active) setSigned(Boolean(data.session));
          const listener = authClient.auth.onAuthStateChange((_event, s) => {
            if (active) setSigned(Boolean(s));
          });
          subscription = listener.data.subscription;
        }
      } catch (e) {
        if (active) setError(e.message);
      }
    }
    boot();
    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, []);
  if (error)
    return (
      <div className="boot">
        <h1>Start the backend first</h1>
        <p role="alert">{error}</p>
        <p>
          In the server terminal run <code>npm run dev</code>, then refresh this
          page.
        </p>
      </div>
    );
  if (!config)
    return (
      <div className="boot">
        <LoaderCircle className="spin" size={32} />
        <p>Connecting to Campus Unify...</p>
      </div>
    );
  return signed ? (
    <Workspace config={config} onSignedOut={() => setSigned(false)} />
  ) : (
    <Login config={config} onSignedIn={() => setSigned(true)} />
  );
}
