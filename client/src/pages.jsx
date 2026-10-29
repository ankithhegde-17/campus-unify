import { useState } from "react";
import Documents from "./Documents";
import {
  Plus,
  Download,
  ArrowUpRight,
  Users,
  GraduationCap,
  Wallet,
  BedDouble,
  ClipboardCheck,
  Building2,
  ShieldCheck,
  FileText,
  Check,
  X,
  ChevronRight,
  Upload,
  ArrowRightLeft,
  UserMinus,
  Send,
  CreditCard,
} from "lucide-react";
import { Table, Badge, Empty, Panel } from "./ui";
import { money, label } from "./lib/format";
import { api, csv, download, parseCSV } from "./lib/client";
import { createRazorpayOrder, openRazorpay } from "./lib/razorpay";
import {
  lookup,
  derive,
  studentBalance,
  feeRows,
  eligibilityRows,
  attendanceRisks,
} from "./lib/derived";

const opts = (rows, key = "full_name") =>
  rows.map((r) => ({ value: r.id, label: r[key] }));
const field = (key, label, type = "text", extra = {}) => ({
  key,
  label,
  type,
  ...extra,
});
const today = () => new Date().toISOString().slice(0, 10);
function assignmentFields(d) {
  return [
    field("campus_id", "Campus", "select", {
      options: opts(d.campuses, "name"),
      reset: ["department_id"],
    }),
    field("department_id", "Department", "select", {
      options: (v) =>
        opts(
          d.departments.filter((x) => x.campus_id === v.campus_id),
          "name",
        ),
    }),
  ];
}
function studentName(d, id) {
  return lookup(d).students.get(id)?.full_name || "Historical student";
}
function campusName(d, id) {
  return lookup(d).campuses.get(id)?.name || "Previous campus";
}
const permitted = (ctx, roles) =>
  ctx.all.assignments.some((a) => roles.includes(a.role_code));
function exportTable(name, rows) {
  download(`${name}.csv`, csv(rows));
}
const actionButton = (title, Icon, fn, disabled = false) => (
  <button
    type="button"
    className="row-button"
    title={title}
    aria-label={title}
    onClick={fn}
    disabled={disabled}
  >
    <Icon size={15} />
  </button>
);

export function Overview(ctx) {
  const { d, all, setPage } = ctx;
  const financial = all.modules.includes("finance"),
    academic = all.modules.includes("attendance"),
    hostel = all.modules.includes("hostels");
  const outstanding = derive(d, "outstanding", () =>
      d.students.reduce((n, s) => n + Math.max(0, studentBalance(d, s.id)), 0),
    ),
    collected = d.payments.reduce((n, p) => n + p.amount, 0);
  const occupied = d.allocations.filter((a) => !a.ends_on).length;
  const risks = attendanceRisks(d);
  const cards = [
    {
      title: "Students in your scope",
      value: d.students.length,
      sub: `${d.students.filter((s) => s.status === "active").length} active enrolments`,
      icon: Users,
      color: "blue",
    },
    ...(financial
      ? [
          {
            title: "Outstanding fees",
            value: money(outstanding),
            sub: "Charges less concessions and receipts",
            icon: Wallet,
            color: "amber",
          },
        ]
      : [
          {
            title: "Staff in your scope",
            value: d.staff.length,
            sub: "Authorized directory records",
            icon: Users,
            color: "amber",
          },
        ]),
    ...(hostel
      ? [
          {
            title: "Hostel occupancy",
            value: `${d.beds.length ? Math.round((occupied / d.beds.length) * 100) : 0}%`,
            sub: `${occupied} occupied of ${d.beds.length} visible beds`,
            icon: BedDouble,
            color: "purple",
          },
        ]
      : [
          {
            title: "Campus coverage",
            value: d.campuses.length,
            sub: "Institutions available to your account",
            icon: Building2,
            color: "purple",
          },
        ]),
    {
      title: academic ? "Attendance at risk" : "Pending requests",
      value: academic
        ? risks.length
        : d.requests.filter((r) => r.status === "pending").length,
      sub: academic
        ? "Below the applicable campus threshold"
        : "Waiting for independent review",
      icon: ClipboardCheck,
      color: "green",
    },
  ];
  return (
    <>
      <div className="welcome">
        <div>
          <span className="eyebrow">Your institutions, connected</span>
          <h2>A clear view of what matters.</h2>
          <p>Students, people and operations. One trusted workspace.</p>
        </div>
        <div className="welcome-mark">
          <Building2 size={48} />
          <span>{d.campuses.length} connected campuses</span>
        </div>
      </div>
      <div className="stats-grid">
        {cards.map((c) => (
          <div className="stat-card" key={c.title}>
            <div className="stat-top">
              <span>{c.title}</span>
              <span className={`stat-icon ${c.color}`}>
                <c.icon size={18} />
              </span>
            </div>
            <strong>{c.value}</strong>
            <p>{c.sub}</p>
          </div>
        ))}
      </div>
      <div className="overview-grid">
        <Panel
          title={
            financial ? "Campus financial overview" : "Campus distribution"
          }
          subtitle="Current records in your authorized scope"
          action={
            <button
              className="text-button"
              onClick={() => setPage(financial ? "reports" : "students")}
            >
              View details <ArrowUpRight size={15} />
            </button>
          }
        >
          <div className="chart-legend">
            <span>
              <i className="dot teal" />
              {financial ? "Collected" : "Students"}
            </span>
            {financial && (
              <span>
                <i className="dot light" />
                Outstanding
              </span>
            )}
          </div>
          <div className="bar-chart">
            {d.campuses.map((c) => {
              const ss = d.students.filter((s) => s.campus_id === c.id),
                ids = new Set(ss.map((s) => s.id)),
                paid = d.payments
                  .filter((p) => p.campus_id === c.id)
                  .reduce((n, p) => n + p.amount, 0),
                due = d.charges
                  .filter((ch) => ch.campus_id === c.id)
                  .reduce((n, ch) => n + ch.amount - ch.concession, 0);
              const max = financial
                ? Math.max(
                    1,
                    ...d.campuses.map((cc) =>
                      d.charges
                        .filter((ch) => ch.campus_id === cc.id)
                        .reduce((n, ch) => n + ch.amount - ch.concession, 0),
                    ),
                  )
                : Math.max(
                    1,
                    ...d.campuses.map(
                      (cc) =>
                        d.students.filter((s) => s.campus_id === cc.id).length,
                    ),
                  );
              return (
                <div className="bar-column" key={c.id}>
                  <div className="bar-value">
                    {financial ? money(due) : ids.size}
                  </div>
                  <div className="bar-track">
                    <div
                      className="bar"
                      style={{
                        height: `${Math.max(3, ((financial ? paid : ss.length) / max) * 100)}%`,
                      }}
                    />
                    {financial && (
                      <div
                        className="bar outstanding"
                        style={{
                          height: `${Math.max(0, ((due - paid) / max) * 100)}%`,
                        }}
                      />
                    )}
                  </div>
                  <span>{c.name}</span>
                </div>
              );
            })}
          </div>
          <div className="chart-footer">
            <span>
              {financial ? "Total net collections" : "Total students"}
            </span>
            <strong>{financial ? money(collected) : d.students.length}</strong>
          </div>
        </Panel>
        <Panel
          title="Needs your attention"
          subtitle="Small actions keep your campuses moving"
        >
          <div className="attention-list">
            {academic && (
              <button onClick={() => setPage("attendance")}>
                <span className="attention-icon amber">
                  <ClipboardCheck size={19} />
                </span>
                <div>
                  <strong>{risks.length} students below threshold</strong>
                  <p>Review attendance and missing entries</p>
                </div>
                <ChevronRight size={16} />
              </button>
            )}
            {financial && (
              <button onClick={() => setPage("finance")}>
                <span className="attention-icon blue">
                  <Wallet size={19} />
                </span>
                <div>
                  <strong>{money(outstanding)} outstanding</strong>
                  <p>Review student balances and collections</p>
                </div>
                <ChevronRight size={16} />
              </button>
            )}
            {all.modules.includes("approvals") && (
              <button onClick={() => setPage("approvals")}>
                <span className="attention-icon purple">
                  <FileText size={19} />
                </span>
                <div>
                  <strong>
                    {d.requests.filter((r) => r.status === "pending").length}{" "}
                    pending requests
                  </strong>
                  <p>Corrections, concessions and transfers</p>
                </div>
                <ChevronRight size={16} />
              </button>
            )}
            {all.modules.includes("staff") && (
              <button onClick={() => setPage("staff")}>
                <span className="attention-icon green">
                  <Users size={19} />
                </span>
                <div>
                  <strong>
                    {d.staff.filter((s) => s.status === "active").length} active
                    staff appointments
                  </strong>
                  <p>Faculty and department leadership</p>
                </div>
                <ChevronRight size={16} />
              </button>
            )}
          </div>
        </Panel>
      </div>
      <div className="overview-grid bottom">
        <Panel
          title="Campus snapshot"
          subtitle="A consistent view across institutions"
        >
          <Table
            search={false}
            rows={d.campuses.map((c) => ({
              ...c,
              students: d.students.filter((s) => s.campus_id === c.id).length,
              staff: d.staff.filter(
                (s) => s.campus_id === c.id && s.status === "active",
              ).length,
            }))}
            columns={[
              {
                key: "name",
                title: "Campus",
                render: (r) => (
                  <div className="name-cell">
                    <span className="avatar small">{r.name.slice(-1)}</span>
                    <div>
                      <strong>{r.name}</strong>
                      <small>{r.code}</small>
                    </div>
                  </div>
                ),
              },
              {
                key: "institution_type",
                title: "Institution",
                render: (r) => label(r.institution_type),
              },
              { key: "students", title: "Students" },
              { key: "staff", title: "Visible staff" },
              {
                key: "is_active",
                title: "Status",
                render: (r) => (
                  <Badge>{r.is_active ? "active" : "inactive"}</Badge>
                ),
              },
            ]}
          />
        </Panel>
        <Panel
          title="Latest announcements"
          subtitle="Updates relevant to your account"
        >
          {d.notices
            .slice(-2)
            .reverse()
            .map((n) => (
              <article className="notice-preview" key={n.id}>
                <span className="eyebrow">
                  {n.campus_id ? campusName(d, n.campus_id) : "Trust notice"}
                </span>
                <h3>{n.title}</h3>
                <p>{n.body}</p>
                <small>
                  {new Date(n.created_at).toLocaleDateString("en-IN")}
                </small>
              </article>
            ))}
          {!d.notices.length && <Empty title="No announcements" />}
        </Panel>
      </div>
    </>
  );
}

export function Students(ctx) {
  const { d, all, open, run } = ctx;
  const manage = permitted(ctx, [
    "trust_management",
    "campus_admin",
    "admissions_officer",
  ]);
  function add() {
    open({
      title: "Register an admission",
      description:
        "One student identity across the trust. Verify the student code before creating a new record.",
      fields: [
        field("student_code", "Trust student code"),
        field("full_name", "Full name"),
        field("dob", "Date of birth", "date"),
        field("class_name", "Class / year"),
        ...assignmentFields(d),
        field("email", "Student email", "email"),
        field("guardian_name", "Guardian name"),
        field("guardian_email", "Guardian email", "email"),
        field("phone", "Contact number"),
      ],
      submit: (v) => run("student.create", v),
      button: "Register admission",
    });
  }
  function correction(s) {
    open({
      title: "Request profile correction",
      initial: { student_id: s.id },
      fields: [
        field("field", "Field", "select", {
          options: [
            "full_name",
            "guardian_name",
            "email",
            "guardian_email",
            "phone",
          ].map((x) => ({ value: x, label: label(x) })),
        }),
        field("new_value", "Correct value"),
        field("details", "Reason / verification notes", "textarea", {
          wide: true,
        }),
      ],
      submit: (v) =>
        run("request.create", {
          ...v,
          student_id: s.id,
          type: "profile_correction",
        }),
      button: "Submit for review",
    });
  }
  function transfer(s) {
    open({
      title: "Request campus transfer",
      description:
        "Trust Management must approve. Identity and historical dues remain unchanged.",
      fields: [
        field("to_campus_id", "Receiving campus", "select", {
          options: opts(
            all.campuses.filter((c) => c.id !== s.campus_id),
            "name",
          ),
          reset: ["department_id"],
        }),
        field("department_id", "Receiving department", "select", {
          options: (v) =>
            opts(
              all.departments.filter((d) => d.campus_id === v.to_campus_id),
              "name",
            ),
        }),
        field("class_name", "Receiving class"),
        field("details", "Transfer reason", "textarea"),
      ],
      submit: (v) =>
        run("request.create", { ...v, student_id: s.id, type: "transfer" }),
      button: "Request transfer",
    });
  }
  return (
    <>
      <Table
        rows={d.students}
        actions={
          manage && (
            <button className="button" onClick={add}>
              <Plus size={16} />
              New admission
            </button>
          )
        }
        columns={[
          {
            key: "full_name",
            title: "Student",
            render: (r) => (
              <div className="name-cell">
                <span className="avatar">
                  {r.full_name
                    .split(" ")
                    .map((x) => x[0])
                    .slice(0, 2)
                    .join("")}
                </span>
                <div>
                  <strong>{r.full_name}</strong>
                  <small>{r.student_code}</small>
                </div>
              </div>
            ),
          },
          {
            key: "campus_id",
            title: "Campus",
            render: (r) => campusName(d, r.campus_id),
          },
          { key: "class_name", title: "Class" },
          {
            key: "status",
            title: "Admission",
            render: (r) => <Badge>{r.status}</Badge>,
          },
          {
            key: "actions",
            title: "Actions",
            render: (r) => (
              <div className="row-actions">
                {actionButton("View permitted details", FileText, () =>
                  open({
                    title: r.full_name,
                    content: (
                      <dl className="details">
                        {Object.entries(r)
                          .filter(([k]) => !k.endsWith("_id") && k !== "id")
                          .map(([k, v]) => (
                            <div key={k}>
                              <dt>{label(k)}</dt>
                              <dd>{String(v ?? "—")}</dd>
                            </div>
                          ))}
                      </dl>
                    ),
                  }),
                )}
                {permitted(ctx, [
                  "trust_management",
                  "campus_admin",
                  "admissions_officer",
                  "student",
                  "parent",
                ]) &&
                  actionButton("Private admission documents", Upload, () =>
                    open({
                      title: "Admission documents",
                      content: (
                        <Documents
                          student={r}
                          d={d}
                          canVerify={manage}
                          onChange={ctx.reload}
                        />
                      ),
                    }),
                  )}
                {actionButton("Request correction", FileText, () =>
                  correction(r),
                )}
                {manage &&
                  r.status === "pending" &&
                  actionButton("Confirm admission", Check, () =>
                    open({
                      title: "Confirm admission",
                      description:
                        "This creates the tuition charge using the currently effective campus rule.",
                      fields: [],
                      submit: () => run("student.admit", { student_id: r.id }),
                      button: "Confirm admission",
                    }),
                  )}
                {manage &&
                  actionButton("Request campus transfer", ArrowRightLeft, () =>
                    transfer(r),
                  )}
              </div>
            ),
          },
        ]}
      />
      <div className="info-strip">
        <ShieldCheck size={18} />
        <span>
          One student identity · Scoped personal fields · Transfers preserve
          financial history
        </span>
      </div>
    </>
  );
}

export function Staff(ctx) {
  const { d, open, run } = ctx,
    manage = permitted(ctx, ["trust_management"]);
  function appoint() {
    open({
      title: "Appoint faculty / HOD",
      description:
        "Records an appointment. Creating a login and granting permissions is a separate privileged operation.",
      fields: [
        field("staff_code", "Employee code"),
        field("full_name", "Full name"),
        ...assignmentFields(d),
        field("designation", "Designation", "select", {
          options: [
            "HOD",
            "Assistant Professor",
            "Lecturer",
            "Administrator",
            "Warden",
          ].map((v) => ({ value: v, label: v })),
        }),
        field("qualification", "Qualification"),
        field("email", "Official email", "email"),
        field("phone", "Official contact"),
        field("started_on", "Appointment date", "date"),
      ],
      initial: { started_on: today() },
      submit: (v) => run("staff.appoint", v),
      button: "Record appointment",
    });
  }
  return (
    <Table
      rows={d.staff}
      actions={
        manage && (
          <button className="button" onClick={appoint}>
            <Plus size={16} />
            Appoint staff
          </button>
        )
      }
      columns={[
        {
          key: "full_name",
          title: "Staff member",
          render: (r) => (
            <div className="name-cell">
              <span className="avatar purple">
                {r.full_name
                  .split(" ")
                  .map((x) => x[0])
                  .slice(0, 2)
                  .join("")}
              </span>
              <div>
                <strong>{r.full_name}</strong>
                <small>{r.staff_code}</small>
              </div>
            </div>
          ),
        },
        { key: "designation", title: "Designation" },
        {
          key: "campus_id",
          title: "Campus",
          render: (r) => campusName(d, r.campus_id),
        },
        { key: "qualification", title: "Qualification" },
        { key: "email", title: "Official email" },
        {
          key: "status",
          title: "Status",
          render: (r) => <Badge>{r.status}</Badge>,
        },
        {
          key: "actions",
          title: "Actions",
          render: (r) =>
            r.status === "active" ? (
              <div className="row-actions">
                {r.portal_user_id &&
                  r.designation !== "HOD" &&
                  permitted(ctx, ["trust_management", "campus_admin", "hod"]) &&
                  actionButton("Assign a class / subject", GraduationCap, () =>
                    open({
                      title: "Assign teaching responsibility",
                      fields: [
                        field("class_name", "Class"),
                        field("subject", "Subject"),
                      ],
                      submit: (v) =>
                        run("teaching.assign", {
                          ...v,
                          user_id: r.portal_user_id,
                          campus_id: r.campus_id,
                          department_id: r.department_id,
                        }),
                    }),
                  )}
                {manage && (
                  <>
                    {actionButton("Transfer staff", ArrowRightLeft, () =>
                      open({
                        title: "Transfer staff appointment",
                        description:
                          "Former teaching assignments are removed. Supabase portal scopes must be updated by an administrator before the staff account can resume access.",
                        fields: [
                          ...assignmentFields(d),
                          field("reason", "Reason", "textarea"),
                        ],
                        submit: (v) =>
                          run("staff.transfer", { ...v, staff_id: r.id }),
                      }),
                    )}
                    {actionButton("End appointment", UserMinus, () =>
                      open({
                        title: "End staff appointment",
                        description:
                          "Historical records are preserved. Linked application access will be disabled.",
                        fields: [
                          field("reason", "Reason for separation", "textarea"),
                        ],
                        submit: (v) =>
                          run("staff.separate", { ...v, staff_id: r.id }),
                        button: "End appointment",
                      }),
                    )}
                  </>
                )}
              </div>
            ) : (
              "—"
            ),
        },
      ]}
    />
  );
}

export function Finance(ctx) {
  const { d, open, run } = ctx,
    manage = permitted(ctx, [
      "trust_management",
      "campus_admin",
      "accounts_officer",
    ]),
    online = manage || permitted(ctx, ["student", "parent"]);
  const chargeCampuses = (s) =>
    opts(
      d.campuses.filter((c) =>
        d.charges.some((ch) => ch.student_id === s.id && ch.campus_id === c.id),
      ),
      "name",
    );
  function payOnline(s) {
    const outstanding = studentBalance(d, s.id);
    open({
      title: `Pay online · ${s.full_name}`,
      description: `Outstanding: ${money(outstanding)}. Pay the full amount or part of it by card, UPI or netbanking through Razorpay.`,
      fields: [
        field("campus_id", "Campus owning the charge", "select", {
          options: chargeCampuses(s),
        }),
        field("amount", "Amount to pay (₹)", "number", {
          min: 1,
          max: outstanding,
        }),
      ],
      initial: { campus_id: s.campus_id, amount: String(outstanding) },
      submit: async (v) => {
        const order = await createRazorpayOrder({ ...v, student_id: s.id });
        // Open once this dialog has closed: a modal <dialog> sits in the top
        // layer and would block clicks on the Razorpay popup.
        setTimeout(() =>
          openRazorpay(order)
            .then(async (result) => {
              await ctx.reload();
              ctx.notify(result.message);
              receipt(result.receipt);
            })
            .catch((e) => (e.cancelled ? ctx.notify(e.message) : ctx.showError(e.message))),
        );
      },
      button: "Continue to payment",
    });
  }
  function pay(s) {
    open({
      title: `Record payment · ${s.full_name}`,
      description: `Current outstanding: ${money(studentBalance(d, s.id))}. A receipt cannot be edited after issue.`,
      fields: [
        field("campus_id", "Campus owning the charge", "select", {
          options: chargeCampuses(s),
        }),
        field("amount", "Amount received", "number", { min: 1 }),
        field("reference", "Unique payment / collection reference"),
        field("method", "Payment method", "select", {
          options: ["Cash", "Bank transfer", "UPI"].map((v) => ({
            value: v,
            label: v,
          })),
        }),
      ],
      initial: { method: "Bank transfer", campus_id: s.campus_id },
      submit: (v) => run("payment.record", { ...v, student_id: s.id }),
      button: "Record & issue receipt",
    });
  }
  function concession(s) {
    open({
      title: "Request a concession",
      fields: [
        field("charge_id", "Charge", "select", {
          options: d.charges
            .filter((c) => c.student_id === s.id)
            .map((c) => ({
              value: c.id,
              label: `${c.head} · ${money(c.amount - c.concession)}`,
            })),
        }),
        field("amount", "Additional concession", "number", { min: 1 }),
        field("details", "Reason", "textarea"),
      ],
      submit: (v) =>
        run("request.create", { ...v, student_id: s.id, type: "concession" }),
      button: "Submit for approval",
    });
  }
  function receipt(p) {
    open({
      title: p.receipt_no,
      content: (
        <div className="receipt">
          <Badge>{p.kind}</Badge>
          <h2>{money(p.amount)}</h2>
          <p>{studentName(d, p.student_id)}</p>
          <dl className="details">
            <div>
              <dt>Reference</dt>
              <dd>{p.reference}</dd>
            </div>
            <div>
              <dt>Date</dt>
              <dd>{p.paid_at}</dd>
            </div>
            <div>
              <dt>Method</dt>
              <dd>{p.method}</dd>
            </div>
            <div>
              <dt>Campus</dt>
              <dd>{campusName(d, p.campus_id)}</dd>
            </div>
          </dl>
          <p className="muted">
            Immutable receipt record. Corrections require an independently
            approved reversal.
          </p>
          <button
            className="button secondary"
            onClick={() =>
              exportTable(p.receipt_no, [
                {
                  receipt: p.receipt_no,
                  student: studentName(d, p.student_id),
                  amount: p.amount,
                  date: p.paid_at,
                  reference: p.reference,
                  kind: p.kind,
                },
              ])
            }
          >
            <Download size={16} />
            Download receipt CSV
          </button>
        </div>
      ),
    });
  }
  return (
    <>
      <div className="mini-stats">
        <div>
          <span>Net charges</span>
          <strong>
            {money(
              derive(d, "netCharges", () =>
                d.charges.reduce((n, c) => n + c.amount - c.concession, 0),
              ),
            )}
          </strong>
        </div>
        <div>
          <span>Net collected</span>
          <strong>{money(d.payments.reduce((n, p) => n + p.amount, 0))}</strong>
        </div>
        <div>
          <span>Outstanding</span>
          <strong>
            {money(
              derive(d, "netOutstanding", () =>
                d.students.reduce((n, s) => n + studentBalance(d, s.id), 0),
              ),
            )}
          </strong>
        </div>
      </div>
      <Panel
        title="Student fee statements"
        subtitle="Concessions, collected amounts and pending dues"
      >
        <Table
          rows={feeRows(d)}
          columns={[
            {
              key: "full_name",
              title: "Student",
              render: (r) => (
                <>
                  <strong>{r.full_name}</strong>
                  <small>{r.student_code}</small>
                </>
              ),
            },
            {
              key: "campus_id",
              title: "Campus",
              render: (r) => campusName(d, r.campus_id),
            },
            {
              key: "balance",
              title: "Outstanding",
              render: (r) => (
                <strong
                  className={r.balance > 0 ? "amount-due" : "amount-paid"}
                >
                  {money(r.balance)}
                </strong>
              ),
            },
            {
              key: "status",
              title: "Payment status",
              render: (r) => (
                <Badge>{r.balance > 0 ? "pending" : "settled"}</Badge>
              ),
            },
            {
              key: "actions",
              title: "Actions",
              render: (r) =>
                online ? (
                  <div className="row-actions">
                    <button
                      className="small-button"
                      disabled={r.balance <= 0}
                      onClick={() => payOnline(r)}
                    >
                      <CreditCard size={14} />
                      Pay online
                    </button>
                    {manage && (
                      <>
                        <button
                          className="small-button"
                          disabled={r.balance <= 0}
                          onClick={() => pay(r)}
                        >
                          Record payment
                        </button>
                        {actionButton("Request concession", FileText, () =>
                          concession(r),
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  "Read only"
                ),
            },
          ]}
        />
      </Panel>
      <Panel
        title="Receipts & reversals"
        subtitle="Original entries remain unchanged"
      >
        <Table
          rows={[...d.payments].reverse()}
          columns={[
            { key: "receipt_no", title: "Receipt" },
            {
              key: "student_id",
              title: "Student",
              render: (r) => studentName(d, r.student_id),
            },
            { key: "amount", title: "Amount", render: (r) => money(r.amount) },
            { key: "paid_at", title: "Date" },
            {
              key: "kind",
              title: "Type",
              render: (r) => <Badge>{r.kind}</Badge>,
            },
            {
              key: "actions",
              title: "Actions",
              render: (r) => (
                <div className="row-actions">
                  {actionButton("View receipt", FileText, () => receipt(r))}
                  {manage &&
                    r.kind === "payment" &&
                    actionButton(
                      "Request full reversal / refund",
                      ArrowRightLeft,
                      () =>
                        open({
                          title: "Request payment reversal",
                          description:
                            "A different authorized person must approve. The original receipt is preserved.",
                          fields: [
                            field(
                              "details",
                              "Reason for reversal / refund",
                              "textarea",
                            ),
                          ],
                          submit: (v) =>
                            run("request.create", {
                              ...v,
                              type: "refund",
                              student_id: r.student_id,
                              payment_id: r.id,
                            }),
                          button: "Request reversal",
                        }),
                    )}
                </div>
              ),
            },
          ]}
        />
      </Panel>
    </>
  );
}

export function Attendance(ctx) {
  const { d, open, run } = ctx,
    [sessionId, setSessionId] = useState(""),
    [busy, setBusy] = useState(false);
  const session =
    d.sessions.find((s) => s.id === sessionId) || d.sessions.at(-1);
  const manage = permitted(ctx, [
    "trust_management",
    "campus_admin",
    "hod",
    "faculty",
  ]);
  const roster = session
    ? d.students.filter(
        (s) =>
          s.campus_id === session.campus_id &&
          s.department_id === session.department_id &&
          s.class_name === session.class_name,
      )
    : [];
  const create = () =>
    open({
      title: "Create class session",
      fields: [
        ...assignmentFields(d),
        field("class_name", "Class"),
        field("subject", "Subject"),
        field("date", "Session date", "date"),
      ],
      initial: {
        class_name: "Year 1 · A",
        subject: "Computer Fundamentals",
        date: today(),
      },
      submit: (v) => run("session.create", v),
    });
  return (
    <>
      <div className="section-toolbar">
        <p>
          Unmarked sessions are shown separately, never silently counted as
          absence.
        </p>
        {manage && (
          <button className="button" onClick={create}>
            <Plus size={16} />
            New session
          </button>
        )}
      </div>
      <Panel
        title="Session register"
        subtitle="Mark only your assigned class and subject"
      >
        <div className="inline-form">
          <label>
            Class session
            <select
              value={session?.id || ""}
              onChange={(e) => setSessionId(e.target.value)}
            >
              {d.sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.date} · {campusName(d, s.campus_id)} · {s.class_name} ·{" "}
                  {s.subject}
                  {s.locked ? " · Locked" : ""}
                </option>
              ))}
            </select>
          </label>
          {session && <Badge>{session.locked ? "locked" : "open"}</Badge>}
          {session &&
            !session.locked &&
            permitted(ctx, ["trust_management", "campus_admin", "hod"]) && (
              <button
                className="small-button"
                onClick={() =>
                  open({
                    title: "Lock attendance session",
                    description:
                      "Subsequent corrections require independent approval.",
                    fields: [],
                    submit: () =>
                      run("session.lock", { session_id: session.id }),
                    button: "Lock session",
                  })
                }
              >
                Lock session
              </button>
            )}
        </div>
        <Table
          rows={roster}
          columns={[
            { key: "full_name", title: "Student" },
            { key: "student_code", title: "Student ID" },
            {
              key: "status",
              title: "Attendance",
              render: (r) => {
                const entry = d.attendance.find(
                  (a) => a.session_id === session.id && a.student_id === r.id,
                );
                return <Badge>{entry?.status || "unmarked"}</Badge>;
              },
            },
            {
              key: "actions",
              title: "Mark attendance",
              render: (r) =>
                manage && !session.locked ? (
                  <div className="row-actions">
                    {["present", "absent", "excused"].map((status) => (
                      <button
                        disabled={busy}
                        className="small-button"
                        key={status}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            await run("attendance.mark", {
                              session_id: session.id,
                              student_id: r.id,
                              status,
                            });
                          } catch {
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        {label(status)}
                      </button>
                    ))}
                  </div>
                ) : (
                  "Locked / read only"
                ),
            },
          ]}
        />
      </Panel>
      <Panel
        title="Attendance eligibility"
        subtitle="Current class sessions · excused entries excluded from the denominator"
      >
        <Table
          rows={eligibilityRows(d)}
          columns={[
            { key: "full_name", title: "Student" },
            {
              key: "present",
              title: "Present / counted",
              render: (r) => `${r.present} / ${r.total}`,
            },
            { key: "missing", title: "Unmarked" },
            {
              key: "percent",
              title: "Attendance",
              render: (r) =>
                r.percent === null ? "No counted entries" : `${r.percent}%`,
            },
            {
              key: "threshold",
              title: "Required",
              render: (r) => `${r.threshold}%`,
            },
            {
              key: "risk",
              title: "Status",
              render: (r) => (
                <Badge>
                  {r.percent === null
                    ? "no data"
                    : r.percent < r.threshold
                      ? "at risk"
                      : "eligible"}
                </Badge>
              ),
            },
            {
              key: "actions",
              title: "Correction",
              render: (r) => (
                <button
                  className="small-button"
                  onClick={() =>
                    open({
                      title: "Request attendance correction",
                      fields: [
                        field(
                          "attendance_id",
                          "Existing attendance entry",
                          "select",
                          {
                            options: d.attendance
                              .filter((a) => a.student_id === r.id)
                              .map((a) => ({
                                value: a.id,
                                label: `${lookup(d).sessions.get(a.session_id)?.date || "Previous session"} · ${a.status}`,
                              })),
                          },
                        ),
                        field("status", "Correct status", "select", {
                          options: ["present", "absent", "excused"].map(
                            (v) => ({ value: v, label: label(v) }),
                          ),
                        }),
                        field("details", "Reason", "textarea"),
                      ],
                      submit: (v) =>
                        run("request.create", {
                          ...v,
                          type: "attendance_correction",
                          student_id: r.id,
                        }),
                      button: "Submit correction",
                    })
                  }
                >
                  Request correction
                </button>
              ),
            },
          ]}
        />
      </Panel>
    </>
  );
}

export function Hostels(ctx) {
  const { d, open, run } = ctx,
    manage = permitted(ctx, ["trust_management", "campus_admin", "warden"]);
  const active = d.allocations.filter((a) => !a.ends_on),
    occupied = new Set(active.map((a) => a.bed_id));
  const available = d.beds.filter((b) => b.available && !occupied.has(b.id));
  return (
    <>
      <div className="section-toolbar">
        <p>Accommodation charges follow the effective campus rule.</p>
        {!manage && (
          <button
            className="button"
            onClick={() =>
              open({
                title: "Request accommodation",
                fields: [
                  field("student_id", "Student", "select", {
                    options: opts(d.students),
                  }),
                  field("details", "Accommodation request", "textarea"),
                ],
                submit: (v) =>
                  run("request.create", { ...v, type: "hostel_request" }),
                button: "Join accommodation waiting list",
              })
            }
          >
            Request accommodation
          </button>
        )}
      </div>
      <div className="mini-stats">
        <div>
          <span>Visible beds</span>
          <strong>{d.beds.length}</strong>
        </div>
        <div>
          <span>Occupied</span>
          <strong>{active.length}</strong>
        </div>
        <div>
          <span>Available</span>
          <strong>{available.length}</strong>
        </div>
      </div>
      <Panel
        title="Room & bed availability"
        subtitle="Each bed can have only one active allocation"
        action={
          manage && (
            <button
              className="button"
              onClick={() =>
                open({
                  title: "Allocate hostel bed",
                  fields: [
                    field("student_id", "Student", "select", {
                      options: opts(
                        d.students.filter(
                          (s) =>
                            s.status === "active" &&
                            !active.some((a) => a.student_id === s.id),
                        ),
                      ),
                    }),
                    field("bed_id", "Available bed", "select", {
                      options: (v) =>
                        available
                          .filter(
                            (b) =>
                              b.campus_id ===
                              d.students.find((s) => s.id === v.student_id)
                                ?.campus_id,
                          )
                          .map((b) => ({
                            value: b.id,
                            label: `${b.hostel} · Room ${b.room} · Bed ${b.bed}`,
                          })),
                    }),
                  ],
                  submit: (v) => run("hostel.allocate", v),
                  button: "Allocate bed",
                })
              }
            >
              <Plus size={16} />
              Allocate bed
            </button>
          )
        }
      >
        <div className="bed-grid">
          {d.beds.map((b) => (
            <div
              className={`bed-card ${occupied.has(b.id) ? "occupied" : ""}`}
              key={b.id}
            >
              <BedDouble size={20} />
              <strong>
                {b.room} · {b.bed}
              </strong>
              <small>{campusName(d, b.campus_id)}</small>
              <Badge>
                {occupied.has(b.id)
                  ? "occupied"
                  : b.available
                    ? "available"
                    : "unavailable"}
              </Badge>
            </div>
          ))}
        </div>
      </Panel>
      <Panel
        title="Resident allocations"
        subtitle="Current and historical stays"
      >
        <Table
          rows={d.allocations}
          columns={[
            {
              key: "student_id",
              title: "Student",
              render: (r) => studentName(d, r.student_id),
            },
            {
              key: "bed_id",
              title: "Room / bed",
              render: (r) => {
                const b = d.beds.find((b) => b.id === r.bed_id);
                return b
                  ? `${b.hostel} · ${b.room}/${b.bed}`
                  : "Previous allocation";
              },
            },
            { key: "starts_on", title: "Check-in" },
            {
              key: "ends_on",
              title: "Check-out",
              render: (r) => r.ends_on || "Currently resident",
            },
            {
              key: "actions",
              title: "Action",
              render: (r) =>
                manage && !r.ends_on ? (
                  <button
                    className="small-button"
                    onClick={() =>
                      open({
                        title: "Confirm hostel check-out",
                        description:
                          "The bed will become available. The allocation history remains.",
                        fields: [],
                        submit: () =>
                          run("hostel.checkout", { allocation_id: r.id }),
                        button: "Check out",
                      })
                    }
                  >
                    Check out
                  </button>
                ) : (
                  "—"
                ),
            },
          ]}
        />
      </Panel>
    </>
  );
}

export function Rules(ctx) {
  const { d, open, run } = ctx;
  return (
    <>
      <div className="section-toolbar">
        <p>
          Versioned campus rules. Saving a new version never silently
          recalculates old charges.
        </p>
        <button
          className="button"
          onClick={() =>
            open({
              title: "Configure a campus rule",
              description:
                "Effective today or later. Historical charges retain their original rule reference.",
              initial: {
                effective_from: today(),
                attendance_threshold: 75,
                concession_percent: 10,
                tuition: 80000,
                hostel: 24000,
              },
              fields: [
                field("campus_id", "Campus", "select", {
                  options: opts(d.campuses, "name"),
                }),
                field("effective_from", "Effective from", "date"),
                field("tuition", "Annual tuition (₹)", "number", { min: 1 }),
                field("hostel", "Hostel charge (₹)", "number", { min: 1 }),
                field(
                  "attendance_threshold",
                  "Attendance required (%)",
                  "number",
                  { min: 1, max: 100 },
                ),
                field(
                  "concession_percent",
                  "Standard concession (%)",
                  "number",
                  { min: 0, max: 100 },
                ),
              ],
              submit: (v) => run("rule.create", v),
              button: "Save new version",
            })
          }
        >
          <Plus size={16} />
          Configure rule
        </button>
      </div>
      <Table
        rows={[...d.rules].reverse()}
        columns={[
          {
            key: "campus_id",
            title: "Campus",
            render: (r) => campusName(d, r.campus_id),
          },
          { key: "version", title: "Version", render: (r) => `v${r.version}` },
          { key: "effective_from", title: "Effective from" },
          { key: "tuition", title: "Tuition", render: (r) => money(r.tuition) },
          { key: "hostel", title: "Hostel", render: (r) => money(r.hostel) },
          {
            key: "attendance_threshold",
            title: "Attendance",
            render: (r) => `${r.attendance_threshold}%`,
          },
          {
            key: "concession_percent",
            title: "Concession rule",
            render: (r) => `${r.concession_percent}%`,
          },
        ]}
      />
    </>
  );
}

export function Approvals(ctx) {
  const { d, all, open, run } = ctx,
    review = permitted(ctx, ["trust_management", "campus_admin"]);
  return (
    <>
      <div className="info-strip">
        <ShieldCheck size={18} />
        <span>
          Requests require a reason. Users cannot decide their own requests.
          Campus transfers require Trust Management.
        </span>
      </div>
      <Table
        rows={[...d.requests].reverse()}
        columns={[
          {
            key: "type",
            title: "Request",
            render: (r) => (
              <>
                <strong>{label(r.type)}</strong>
                <small>
                  {new Date(r.created_at).toLocaleDateString("en-IN")}
                </small>
              </>
            ),
          },
          {
            key: "student_id",
            title: "Student",
            render: (r) => studentName(d, r.student_id),
          },
          { key: "details", title: "Reason" },
          {
            key: "status",
            title: "Status",
            render: (r) => <Badge>{r.status}</Badge>,
          },
          {
            key: "actions",
            title: "Review",
            render: (r) =>
              r.status === "pending" && review ? (
                <div className="row-actions">
                  {["approved", "rejected"].map((decision) => (
                    <button
                      key={decision}
                      className="small-button"
                      disabled={
                        r.created_by === all.profile.id ||
                        (r.type === "transfer" &&
                          !permitted(ctx, ["trust_management"]))
                      }
                      onClick={() =>
                        open({
                          title: `${label(decision)} · ${label(r.type)}`,
                          description: r.details,
                          fields: [
                            field("reason", "Decision reason", "textarea"),
                          ],
                          submit: (v) =>
                            run("request.decide", {
                              ...v,
                              request_id: r.id,
                              decision,
                            }),
                          button:
                            decision === "approved"
                              ? "Approve request"
                              : "Reject request",
                        })
                      }
                    >
                      {decision === "approved" ? (
                        <Check size={14} />
                      ) : (
                        <X size={14} />
                      )}{" "}
                      {label(decision)}
                    </button>
                  ))}
                </div>
              ) : (
                r.decision_reason || "Awaiting authorized reviewer"
              ),
          },
        ]}
      />
    </>
  );
}

export function Scholarships(ctx) {
  const { d, open, run } = ctx,
    manage = permitted(ctx, [
      "trust_management",
      "campus_admin",
      "accounts_officer",
    ]);
  const next = {
    application: "approved",
    approved: "claimed",
    claimed: "received",
  };
  return (
    <>
      <div className="section-toolbar">
        <p>Record an application without counting it as received money.</p>
        <button
          className="button"
          onClick={() =>
            open({
              title: "Scholarship application",
              fields: [
                field("student_id", "Student", "select", {
                  options: opts(d.students),
                }),
                field("scheme", "Scheme name"),
                field("amount", "Requested benefit", "number", { min: 1 }),
              ],
              submit: (v) => run("scholarship.create", v),
              button: "Record application",
            })
          }
        >
          <Plus size={16} />
          New application
        </button>
      </div>
      <div className="info-strip">
        <Wallet size={18} />
        <span>
          Applications and claims do not count as collected money. Only received
          reimbursements create a payment.
        </span>
      </div>
      <Table
        rows={d.scholarships}
        columns={[
          {
            key: "student_id",
            title: "Student",
            render: (r) => studentName(d, r.student_id),
          },
          { key: "scheme", title: "Scheme" },
          { key: "amount", title: "Benefit", render: (r) => money(r.amount) },
          {
            key: "status",
            title: "Stage",
            render: (r) => <Badge>{r.status}</Badge>,
          },
          {
            key: "received",
            title: "Received",
            render: (r) => money(r.received),
          },
          {
            key: "actions",
            title: "Next step",
            render: (r) =>
              manage && next[r.status] ? (
                <button
                  className="small-button"
                  onClick={() =>
                    open({
                      title: `Mark scholarship ${next[r.status]}`,
                      description:
                        next[r.status] === "received"
                          ? "Received money will reduce the student balance. Do not post a pending claim as received."
                          : "Record the next verified stage.",
                      fields:
                        next[r.status] === "received"
                          ? [
                              field(
                                "reference",
                                "Unique reimbursement reference",
                              ),
                            ]
                          : [],
                      submit: (v) =>
                        run("scholarship.update", {
                          ...v,
                          scholarship_id: r.id,
                          status: next[r.status],
                        }),
                      button: `Mark ${next[r.status]}`,
                    })
                  }
                >
                  {label(next[r.status])}
                  <ChevronRight size={14} />
                </button>
              ) : (
                "—"
              ),
          },
        ]}
      />
    </>
  );
}

export function Reports(ctx) {
  const { d, run } = ctx;
  const rows = d.report_rows || [];
  return (
    <>
      <div className="section-toolbar">
        <p>
          Consistent campus filters. Export only the records returned for your
          account.
        </p>
        <button
          className="button"
          onClick={async () => {
            try {
              await run("report.export", {});
              exportTable(
                "campus-unify-consolidated-report",
                rows.map(({ id: _id, campus_id: _campusId, ...r }) => r),
              );
            } catch {}
          }}
        >
          <Download size={16} />
          Export report
        </button>
      </div>
      <Table
        rows={rows}
        columns={[
          { key: "campus", title: "Campus" },
          { key: "students", title: "Students" },
          {
            key: "net_charges",
            title: "Net charges",
            render: (r) => money(r.net_charges),
          },
          {
            key: "collected",
            title: "Collected",
            render: (r) => money(r.collected),
          },
          {
            key: "outstanding",
            title: "Outstanding",
            render: (r) => money(r.outstanding),
          },
          {
            key: "occupied",
            title: "Occupancy",
            render: (r) => `${r.occupied}/${r.beds}`,
          },
          { key: "attendance_risk", title: "Attendance risk" },
        ]}
      />
      <div className="info-strip">
        <FileText size={18} />
        <span>
          Fictional sample data. These results are not measured against
          organizer-provided ground truth. Missing modules are not accessible to
          this role.
        </span>
      </div>
    </>
  );
}

export function Notices(ctx) {
  const { d, open, run } = ctx,
    manage = permitted(ctx, ["trust_management", "campus_admin"]);
  return (
    <>
      {manage && (
        <div className="section-toolbar">
          <p>In-app communication to authorized campus audiences.</p>
          <button
            className="button"
            onClick={() =>
              open({
                title: "Publish announcement",
                fields: [
                  field("campus_id", "Campus", "select", {
                    required: !permitted(ctx, ["trust_management"]),
                    options: opts(d.campuses, "name"),
                  }),
                  field("audience", "Audience", "select", {
                    options: [
                      "all",
                      "student",
                      "parent",
                      "faculty",
                      "warden",
                    ].map((v) => ({ value: v, label: label(v) })),
                  }),
                  field("title", "Title"),
                  field("body", "Message", "textarea", {
                    wide: true,
                    max: 3000,
                  }),
                ],
                initial: { audience: "all" },
                submit: (v) => run("notice.create", v),
                button: "Publish notice",
              })
            }
          >
            <Send size={16} />
            Publish notice
          </button>
        </div>
      )}
      <div className="notices-grid">
        {[...d.notices].reverse().map((n) => (
          <article className="panel notice-card" key={n.id}>
            <Badge>
              {n.campus_id ? campusName(d, n.campus_id) : "Trust wide"}
            </Badge>
            <h2>{n.title}</h2>
            <p>{n.body}</p>
            <footer>
              <span>{new Date(n.created_at).toLocaleDateString("en-IN")}</span>
              <span>Audience: {label(n.audience)}</span>
            </footer>
            <button
              className="small-button"
              disabled={(d.acknowledgements || []).some(
                (a) => a.notice_id === n.id,
              )}
              onClick={() =>
                open({
                  title: "Acknowledge announcement",
                  description: n.title,
                  fields: [],
                  submit: () => run("notice.acknowledge", { notice_id: n.id }),
                  button: "Acknowledge",
                })
              }
            >
              {(d.acknowledgements || []).some((a) => a.notice_id === n.id)
                ? "Acknowledged"
                : "Acknowledge"}
            </button>
          </article>
        ))}
      </div>
      {!d.notices.length && <Empty title="No announcements for your account" />}
    </>
  );
}

export function Audit({ d }) {
  return (
    <Table
      rows={d.audit}
      columns={[
        {
          key: "at",
          title: "Time",
          render: (r) => new Date(r.at).toLocaleString("en-IN"),
        },
        { key: "actor", title: "Actor" },
        { key: "action", title: "Action" },
        {
          key: "entity",
          title: "Record",
          render: (r) => (
            <span className="mono">{String(r.entity).slice(0, 12)}</span>
          ),
        },
        { key: "details", title: "Reason / result" },
      ]}
    />
  );
}
export function UsersPage({ d, all, open, run }) {
  return (
    <>
      <div className="info-strip">
        <ShieldCheck size={18} />
        <span>
          Account lifecycle only. This role does not receive student financial
          or academic records. New live accounts and scoped grants use the
          documented provisioning process.
        </span>
      </div>
      <Table
        rows={d.users}
        columns={[
          { key: "full_name", title: "User" },
          { key: "email", title: "Account email" },
          { key: "role", title: "Role", render: (r) => label(r.role) },
          {
            key: "is_active",
            title: "Access",
            render: (r) => <Badge>{r.is_active ? "active" : "inactive"}</Badge>,
          },
          {
            key: "actions",
            title: "Action",
            render: (r) =>
              all.assignments.some((a) => a.role_code === "system_admin") ? (
                <button
                  className="small-button"
                  onClick={() =>
                    open({
                      title: r.is_active
                        ? "Disable application access"
                        : "Enable application access",
                      description:
                        "Historical actions remain attributable to this account.",
                      fields: [],
                      submit: () => run("user.toggle", { user_id: r.id }),
                    })
                  }
                >
                  {r.is_active ? "Deactivate" : "Activate"}
                </button>
              ) : (
                "Directory access"
              ),
          },
        ]}
      />
    </>
  );
}

const sample =
  "student_code,full_name,dob,email,guardian_name,guardian_email,phone,class_name\nNEW1001,Aditi Demo,2007-04-15,aditi@example.invalid,Demo Guardian,guardian@example.invalid,9000000099,Year 1 · A\nNEW1002,Rohan Demo,2007-06-12,rohan@example.invalid,Demo Guardian,guardian2@example.invalid,9000000098,Year 1 · A\nST1001,Ananya Rao,2000-01-15,ananya@example.invalid,Demo Guardian,guardian3@example.invalid,9000000097,Year 1 · A\nALT1001,Ananya Rao,2000-01-15,ananya@example.invalid,Demo Guardian,guardian3@example.invalid,9000000097,Year 1 · A";
export function Imports(ctx) {
  const { d, run } = ctx,
    [source, setSource] = useState(sample),
    [campus, setCampus] = useState(d.campuses[0]?.id || ""),
    [department, setDepartment] = useState(""),
    [preview, setPreview] = useState(null),
    [decisions, setDecisions] = useState({}),
    [reviewReason, setReviewReason] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function inspect() {
    setBusy(true);
    setError("");
    try {
      const result = await api("/import/preview", {
        method: "POST",
        body: JSON.stringify({ campus_id: campus, rows: parseCSV(source) }),
      });
      setPreview(result);
      setDecisions(
        Object.fromEntries(
          result.rows.map((r) => [
            r.index,
            r.status === "new" ? "new" : r.match?.id ? "link" : "skip",
          ]),
        ),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function commit() {
    setBusy(true);
    setError("");
    try {
      await run("import.commit", {
        campus_id: campus,
        department_id: department,
        source_name: "CSV import",
        rows: parseCSV(source),
        decisions,
        review_reason: reviewReason,
      });
      setPreview(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Panel
        title="Import student records"
        subtitle="Preview before committing · exact identities link · uncertain matches remain for review"
      >
        <div className="form-grid">
          <label>
            Campus
            <select
              value={campus}
              onChange={(e) => {
                setCampus(e.target.value);
                setDepartment("");
                setPreview(null);
              }}
            >
              {d.campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Department
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            >
              <option value="">Select department</option>
              {d.departments
                .filter((dep) => dep.campus_id === campus)
                .map((dep) => (
                  <option key={dep.id} value={dep.id}>
                    {dep.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="wide">
            Upload CSV
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                if (file.size > 500000) {
                  setError("Use a CSV smaller than 500 KB.");
                  return;
                }
                setSource(await file.text());
                setPreview(null);
              }}
            />
          </label>
          <label className="wide">
            CSV preview
            <textarea
              className="mono"
              rows={7}
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
                setPreview(null);
              }}
            />
          </label>
        </div>
        {error && (
          <p className="alert error" role="alert">
            {error}
          </p>
        )}
        <div className="section-toolbar">
          <button
            className="button secondary"
            onClick={() => download("student-import-template.csv", sample)}
          >
            <Download size={16} />
            Download sample CSV
          </button>
          <button
            className="button"
            disabled={busy || !department}
            onClick={inspect}
          >
            <Upload size={16} />
            {busy ? "Working..." : "Validate & find duplicates"}
          </button>
        </div>
      </Panel>
      {preview && (
        <Panel
          title="Review import decisions"
          subtitle={
            preview.duplicateBatch
              ? "This exact batch has already been imported."
              : "No existing profile is overwritten. Reviewed links retain source provenance and the reviewer’s reason."
          }
        >
          <Table
            rows={preview.rows.map((r) => ({ ...r, id: r.index }))}
            columns={[
              {
                key: "row",
                title: "Student",
                render: (r) => (
                  <>
                    <strong>{r.row.full_name}</strong>
                    <small>{r.row.student_code}</small>
                  </>
                ),
              },
              {
                key: "status",
                title: "Validation",
                render: (r) => <Badge>{r.status}</Badge>,
              },
              {
                key: "errors",
                title: "Findings",
                render: (r) =>
                  r.errors.join("; ") ||
                  (r.match?.review_required
                    ? "Cross-campus identity: authorized review required"
                    : r.match
                      ? "Existing exact student code"
                      : r.candidates.length
                        ? "Same name and date of birth: review required"
                        : "No candidate found"),
              },
              {
                key: "decision",
                title: "Decision",
                render: (r) => (
                  <select
                    aria-label={`Decision for row ${r.index + 1}`}
                    value={decisions[r.index] || "skip"}
                    onChange={(e) =>
                      setDecisions({ ...decisions, [r.index]: e.target.value })
                    }
                  >
                    <option value="skip">Skip / hold for review</option>
                    {r.status === "new" && (
                      <option value="new">Create pending admission</option>
                    )}
                    {r.match?.id && !r.errors.length && (
                      <option value="link">Link existing identity</option>
                    )}
                    {permitted(ctx, ["trust_management", "campus_admin"]) &&
                      r.candidates.map((c) => (
                        <option key={c.id} value={`link:${c.id}`}>
                          Verified match: {c.full_name} ({c.student_code})
                        </option>
                      ))}
                  </select>
                ),
              },
            ]}
          />
          <div className="section-toolbar">
            <label>
              Verification reason for manually linked candidates
              <input
                value={reviewReason}
                onChange={(e) => setReviewReason(e.target.value)}
                placeholder="Required for reviewed matches"
              />
            </label>
            <button
              className="button"
              disabled={busy || preview.duplicateBatch}
              onClick={commit}
            >
              Commit reviewed import
            </button>
          </div>
        </Panel>
      )}
      <Panel
        title="Import history"
        subtitle="Source rows and fingerprints are retained"
      >
        <Table
          rows={[...d.imports].reverse()}
          columns={[
            { key: "source_name", title: "Source" },
            { key: "added", title: "New" },
            { key: "linked", title: "Linked" },
            { key: "skipped", title: "Skipped" },
            {
              key: "created_at",
              title: "Imported",
              render: (r) => new Date(r.created_at).toLocaleString("en-IN"),
            },
          ]}
        />
      </Panel>
    </>
  );
}
