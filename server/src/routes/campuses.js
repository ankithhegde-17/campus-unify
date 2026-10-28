import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.use(requireAuth);

function isTrustManagement(assignments) {
  return assignments.some(
    (assignment) =>
      assignment.role_code === "trust_management" &&
      assignment.scope === "trust"
  );
}

// List campuses permitted by the user's database policies.
router.get("/", async (req, res) => {
  const assignments = req.auth.assignments;

  const canRead =
    isTrustManagement(assignments) ||
    assignments.some((assignment) => assignment.campus_id);

  if (!canRead) {
    return res.status(403).json({
      error: "You do not have access to campus records.",
    });
  }

  const { data, error } = await req.supabase
    .from("campuses")
    .select("id, code, name, institution_type, is_active, created_at")
    .order("name");

  if (error) {
    console.error("Campus listing failed:", error.message);

    return res.status(500).json({
      error: "Unable to load campuses.",
    });
  }

  return res.json({ campuses: data });
});

// Create a campus: Trust Management only.
router.post("/", async (req, res) => {
  if (!isTrustManagement(req.auth.assignments)) {
    return res.status(403).json({
      error: "Only Trust Management can create campuses.",
    });
  }

  const body = req.body;

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return res.status(400).json({
      error: "A campus object is required.",
    });
  }

  const allowedFields = ["code", "name", "institution_type"];

  if (Object.keys(body).some((key) => !allowedFields.includes(key))) {
    return res.status(400).json({
      error: "Only code, name, and institution_type are accepted.",
    });
  }

  const code =
    typeof body.code === "string" ? body.code.trim().toUpperCase() : "";

  const name =
    typeof body.name === "string" ? body.name.trim() : "";

  const institutionType = body.institution_type;

  const allowedTypes = [
    "engineering",
    "polytechnic",
    "school",
    "other",
  ];

  if (!code || code.length > 30 || !/^[A-Z0-9_-]+$/.test(code)) {
    return res.status(400).json({
      error:
        "Use a campus code of 1–30 letters, numbers, hyphens, or underscores.",
    });
  }

  if (!name || name.length > 200) {
    return res.status(400).json({
      error: "Campus name must contain 1–200 characters.",
    });
  }

  if (!allowedTypes.includes(institutionType)) {
    return res.status(400).json({
      error: "Select a valid institution type.",
    });
  }

  const { data, error } = await req.supabase
    .from("campuses")
    .insert({
      code,
      name,
      institution_type: institutionType,
    })
    .select("id, code, name, institution_type, is_active, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        error: "That campus code already exists.",
      });
    }

    if (error.code === "42501") {
      return res.status(403).json({
        error: "Campus creation was denied by the database.",
      });
    }

    console.error("Campus creation failed:", error.message);

    return res.status(500).json({
      error: "Unable to create the campus.",
    });
  }

  return res.status(201).json({ campus: data });
});

export default router;