import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.use(requireAuth);

router.get("/", async (req, res) => {
  const canRead = req.auth.assignments.some(
    (assignment) =>
      (
        assignment.role_code === "trust_management" &&
        assignment.scope === "trust"
      ) ||
      Boolean(assignment.campus_id)
  );

  if (!canRead) {
    return res.status(403).json({
      error: "You do not have access to departments.",
    });
  }

  const { data, error } = await req.supabase
    .from("departments")
    .select(`
      id,
      code,
      name,
      campus_id,
      is_active,
      campus:campuses (
        name,
        code
      )
    `)
    .order("name");

  if (error) {
    console.error("Department listing failed:", error.message);

    return res.status(500).json({
      error: "Unable to load departments.",
    });
  }

  return res.json({ departments: data });
});

export default router;