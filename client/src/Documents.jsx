import { useState } from "react";
import { api } from "./lib/client";
import { Badge } from "./ui";
export default function Documents({ student, d, canVerify, onChange }) {
  const [documents, setDocuments] = useState(
      (d.documents || []).filter((x) => x.student_id === student.id),
    ),
    [type, setType] = useState("Identity proof"),
    [file, setFile] = useState(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [reason, setReason] = useState("");
  async function upload() {
    if (!file) return;
    setBusy(true);
    setMessage("");
    try {
      if (file.size > 512000) throw new Error("Maximum file size is 500 KB.");
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = () => reject(new Error("Unable to read the file."));
        reader.readAsDataURL(file);
      });
      const result = await api("/documents", {
        method: "POST",
        body: JSON.stringify({
          student_id: student.id,
          document_type: type,
          filename: file.name,
          base64,
        }),
      });
      setDocuments([...documents, result.document]);
      await onChange();
      setMessage(result.message);
      setFile(null);
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function get(doc) {
    setBusy(true);
    try {
      const result = await api(`/documents/${doc.id}`),
        bytes = Uint8Array.from(atob(result.base64), (c) => c.charCodeAt(0)),
        url = URL.createObjectURL(
          new Blob([bytes], { type: result.content_type }),
        ),
        a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function verify(doc, status) {
    setBusy(true);
    try {
      const result = await api("/actions/document.verify", {
        method: "POST",
        body: JSON.stringify({ document_id: doc.id, status, reason }),
      });
      setDocuments(
        documents.map((x) => (x.id === doc.id ? { ...x, status } : x)),
      );
      await onChange();
      setMessage(result.message);
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="documents">
      <p className="muted">
        Private attachments for {student.full_name}. PDF, PNG or JPEG; maximum
        500 KB. Upload only synthetic documents in this demonstration.
      </p>
      <label>
        Document category
        <select value={type} onChange={(e) => setType(e.target.value)}>
          {[
            "Identity proof",
            "Admission form",
            "Previous academic record",
            "Consent record",
          ].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <label>
        Choose attachment
        <input
          type="file"
          accept="application/pdf,image/png,image/jpeg"
          onChange={(e) => setFile(e.target.files[0] || null)}
        />
      </label>
      <button
        type="button"
        className="button"
        disabled={!file || busy}
        onClick={upload}
      >
        Upload private document
      </button>
      {message && (
        <p role="status" className="muted">
          {message}
        </p>
      )}
      {canVerify && (
        <label>
          Verification reason
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Required before verifying or rejecting"
          />
        </label>
      )}
      <div className="document-list">
        {documents.map((doc) => (
          <article key={doc.id}>
            <div>
              <strong>{doc.document_type}</strong>
              <small>{doc.filename}</small>
              <Badge>{doc.status}</Badge>
            </div>
            <div className="row-actions">
              <button
                type="button"
                className="small-button"
                disabled={busy}
                onClick={() => get(doc)}
              >
                Download
              </button>
              {canVerify &&
                ["verified", "rejected"].map((status) => (
                  <button
                    type="button"
                    className="small-button"
                    key={status}
                    disabled={busy || !reason.trim()}
                    onClick={() => verify(doc, status)}
                  >
                    {status === "verified" ? "Verify" : "Reject"}
                  </button>
                ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
