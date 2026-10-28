import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStore } from "../src/store.js";
import { createApp } from "../src/app.js";
test("HTTP authentication, scoped data, atomic persistence and denial behavior", async () => {
  const dir = await mkdtemp(join(tmpdir(), "cu-test-")),
    file = join(dir, "workspace.json");
  const store = await createStore({ mode: "demo", file });
  const server = createApp(store).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    const get = (path, token) =>
      fetch(url + path, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    assert.equal((await get("/api/workspace")).status, 401);
    const login = async (role) => {
      const response = await fetch(url + "/api/auth/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: `${role}@demo.local`,
          password: "Demo@12345",
        }),
      });
      assert.equal(response.status, 200);
      return (await response.json()).token;
    };
    const token = await login("campus_admin"),
      response = await get("/api/workspace", token),
      data = await response.json();
    assert.equal(data.students.length, 12);
    assert.equal(data.campuses.length, 1);
    const faculty = await login("faculty"),
      fv = await (await get("/api/workspace", faculty)).json();
    assert.equal(fv.charges.length, 0);
    const denied = await fetch(url + "/api/actions/staff.appoint", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${faculty}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    assert.equal(denied.status, 403);
    assert.equal((await get("/api/does-not-exist", token)).status, 404);
    const trust = await login("trust_management"),
      all = await (await get("/api/workspace", trust)).json();
    const payment = async (ref) =>
      fetch(url + "/api/actions/payment.record", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${trust}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          student_id: all.students[0].id,
          amount: 100,
          reference: ref,
        }),
      });
    const results = await Promise.all([
      payment("CONCURRENT-REF"),
      payment("CONCURRENT-REF"),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
    const reloaded = await createStore({ mode: "demo", file });
    assert.equal(
      (await reloaded.read()).payments.filter(
        (p) => p.reference === "CONCURRENT-REF",
      ).length,
      1,
    );
    const logout = await fetch(url + "/api/auth/logout", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    assert.equal(logout.status, 200);
    assert.equal((await get("/api/me", token)).status, 401);
  } finally {
    await new Promise((r) => server.close(r));
    await rm(dir, { recursive: true, force: true });
  }
});

test("private documents, role denial and immediate account deactivation", async () => {
  const dir = await mkdtemp(join(tmpdir(), "cu-private-")),
    store = await createStore({
      mode: "demo",
      file: join(dir, "workspace.json"),
    });
  const server = createApp(store).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const url = `http://127.0.0.1:${server.address().port}`;
  let documentId;
  try {
    const call = (path, token, body) =>
      fetch(url + path, {
        method: body ? "POST" : "GET",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    const login = async (role) =>
      (
        await (
          await call("/api/auth/demo", null, {
            email: `${role}@demo.local`,
            password: "Demo@12345",
          })
        ).json()
      ).token;
    const parent = await login("parent"),
      faculty = await login("faculty"),
      admin = await login("system_admin"),
      state = await store.read(),
      student = state.students[0];
    let response = await call("/api/documents", parent, {
      student_id: student.id,
      document_type: "Admission form",
      filename: "synthetic.pdf",
      base64: Buffer.from("%PDF-1.4\n% Synthetic test file\n%%EOF").toString(
        "base64",
      ),
    });
    assert.equal(response.status, 201);
    documentId = (await response.json()).document.id;
    assert.equal(
      (await call(`/api/documents/${documentId}`, parent)).status,
      200,
    );
    assert.equal(
      (await call(`/api/documents/${documentId}`, faculty)).status,
      403,
    );
    response = await call("/api/documents", parent, {
      student_id: state.students[1].id,
      document_type: "Admission form",
      filename: "bad.pdf",
      base64: "aGVsbG8=",
    });
    assert.equal(response.status, 403);
    response = await call("/api/actions/user.toggle", admin, {
      user_id: state.users.find((u) => u.role === "faculty").id,
    });
    assert.equal(response.status, 200);
    assert.equal((await call("/api/workspace", faculty)).status, 403);
  } finally {
    await new Promise((r) => server.close(r));
    await rm(dir, { recursive: true, force: true });
    if (documentId)
      await rm(new URL(`../data/documents/${documentId}`, import.meta.url), {
        force: true,
      });
  }
});
