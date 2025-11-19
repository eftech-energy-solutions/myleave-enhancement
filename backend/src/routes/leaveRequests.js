import express from "express";
import pool from "../db.js";
import multer from "multer";

const router = express.Router();

// simpan attachment (kalau ada)
const upload = multer({ dest: "uploads/leave_attachments/" });

/* ============================================================
   1) CREATE NEW LEAVE REQUEST  (POST /api/leave-requests)
   ============================================================ */
router.post("/", upload.single("attachment"), async (req, res) => {
  try {
    // data dari FormData (frontend)
    const {
      type,
      requestType,
      duration,
      dateFrom,
      dateUntil,
      totalDays,
      reason
    } = req.body;

// Wajib ada req.user yang valid
const user = req.user;

if (!user || !user.staff_id) {
  return res.status(401).json({ message: "User not attached to request" });
}

const staffId       = user.staff_id;
const staffName     = user.full_name;
const department    = user.department || null;
const requesterRole = user.role || "Staff";
const attachmentPath = req.file ? req.file.path : null;

    // simple validation
    if (!type || !dateFrom || !dateUntil || !totalDays || !reason) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const sql = `
      INSERT INTO leave_requests (
        staff_id,
        staff_name,
        department,
        requester_role,
        leave_type,
        request_type,
        duration,
        date_from,
        date_until,
        total_days,
        reason,
        attachment_path,
        status,
        created_at
      )
      VALUES (
        $1,$2,$3,$4,
        $5,$6,$7,
        $8,$9,$10,
        $11,$12,
        'pending', NOW()
      )
      RETURNING *;
    `;

    const params = [
      staffId,
      staffName,
      department,
      requesterRole,
      type,
      requestType || "new",
      duration,
      dateFrom,
      dateUntil,
      totalDays,
      reason,
      attachmentPath
    ];

    const result = await pool.query(sql, params);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("POST /api/leave-requests error:", err);
    res.status(500).json({ message: "Failed to create leave request" });
  }
});

/* ============================================================
   2) GET LEAVE REQUESTS  (GET /api/leave-requests?status=pending)
   ============================================================ */
router.get("/", async (req, res) => {
  try {
    const { status } = req.query;

    const sql = `
      SELECT 
        lr.*,
        p.email,
        p.department AS profile_department,
        p.employment_date,
        p.confirmation_date,
        p.termination_date,
        p.gender,
        p.full_name AS profile_name,
        p.photourl AS photo_url,
        p.leave_entitlement_annual,
        p.leave_entitlement_medical,
        p.notes
      FROM leave_requests lr
      LEFT JOIN profiles p
        ON p.staff_id = lr.staff_id
      ${status ? "WHERE lr.status = $1" : ""}
      ORDER BY lr.created_at DESC;
    `;

    const params = status ? [status] : [];

    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error("GET /api/leave-requests error:", err);
    res.status(500).json({ message: "Failed to load leave requests" });
  }
});

/* ============================================================
   3) UPDATE STATUS (APPROVE / REJECT)
   PATCH /api/leave-requests/:id
   ============================================================ */
router.patch("/:id", async (req, res) => {
  try {
    const { status } = req.body;
    const leaveId = req.params.id;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const sql = `
  UPDATE leave_requests
  SET status = $1
  WHERE leave_id = $2
  RETURNING *;
`;


    const result = await pool.query(sql, [status, leaveId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Leave request not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("PATCH /api/leave-requests error:", err);
    res.status(500).json({ message: "Failed to update leave request" });
  }
});

export default router;
