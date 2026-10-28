import { Router } from "express";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { studentAllowed, hasRole, fail } from "./domain/access.js";
const folder = fileURLToPath(new URL("../data/documents/", import.meta.url));
function allowed(state, actor, studentId) {
  const s = state.students.find((s) => s.id === studentId);
  if (
    !s ||
    !studentAllowed(state, actor, s) ||
    !hasRole(
      actor,
      "trust_management",
      "campus_admin",
      "admissions_officer",
      "student",
      "parent",
    )
  )
    fail("Document access denied.", 403);
  return s;
}
export function documentRoutes(store) {
  const router = Router();
  router.post("/", async (req, res) => {
    const { student_id, filename, base64, document_type } = req.body || {};
    const state = await store.read();
    const s = allowed(state, req.actor, student_id);
    if (
      ![
        "Identity proof",
        "Admission form",
        "Previous academic record",
        "Consent record",
      ].includes(document_type)
    )
      fail("Select a supported document type.");
    if (typeof base64 !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64))
      fail("Invalid file encoding.");
    const buffer = Buffer.from(base64, "base64");
    if (!buffer.length || buffer.length > 512000)
      fail("Use a PDF, PNG or JPEG smaller than 500 KB.");
    const type =
      buffer.subarray(0, 5).toString() === "%PDF-"
        ? "application/pdf"
        : buffer
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          ? "image/png"
          : buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255
            ? "image/jpeg"
            : null;
    if (!type) fail("Only valid PDF, PNG and JPEG files are accepted.");
    const key = randomUUID();
    const safeName = String(filename || "document")
      .replace(/[^a-zA-Z0-9._ -]/g, "_")
      .slice(0, 100);
    let saved = false;
    try {
      if (store.admin) {
        const { error } = await store.admin.storage
          .from("cu-documents")
          .upload(key, buffer, { contentType: type, upsert: false });
        if (error) throw error;
      } else {
        await mkdir(folder, { recursive: true });
        await writeFile(folder + key, buffer);
      }
      saved = true;
      const doc = {
        id: key,
        student_id,
        campus_id: s.campus_id,
        filename: safeName,
        document_type,
        content_type: type,
        size: buffer.length,
        status: "pending",
        storage_key: key,
        uploaded_by: req.actor.userId,
        uploaded_at: new Date().toISOString(),
      };
      await store.mutate((d) => {
        allowed(d, req.actor, student_id);
        d.documents ||= [];
        d.documents.push(doc);
        d.audit.push({
          id: randomUUID(),
          at: doc.uploaded_at,
          actor: req.actor.profile.full_name,
          action: "document.upload",
          campus_id: s.campus_id,
          entity: key,
          details: document_type,
        });
      });
      const { storage_key, ...safe } = doc;
      res.status(201).json({
        document: safe,
        message: "Private document uploaded for verification.",
      });
    } catch (e) {
      if (saved) {
        if (store.admin)
          await store.admin.storage.from("cu-documents").remove([key]);
        else await unlink(folder + key).catch(() => {});
      }
      throw e;
    }
  });
  router.get("/:id", async (req, res) => {
    const state = await store.read();
    const doc = (state.documents || []).find((d) => d.id === req.params.id);
    if (!doc) fail("Document not found.", 404);
    allowed(state, req.actor, doc.student_id);
    let buffer;
    if (store.admin) {
      const { data, error } = await store.admin.storage
        .from("cu-documents")
        .download(doc.storage_key);
      if (error) throw error;
      buffer = Buffer.from(await data.arrayBuffer());
    } else buffer = await readFile(folder + doc.storage_key);
    res.json({
      filename: doc.filename,
      content_type: doc.content_type,
      base64: buffer.toString("base64"),
    });
  });
  return router;
}
