import express from "express";
import pool from "../db.js";
import multer from "multer";

const router = express.Router();

// simpan attachment (kalau ada)
const upload = multer({ dest: "uploads/leave_attachments/" });

/* ============================================================
   1) CREATE NEW LEAVE REQUEST
   POST /api/leave-requests
   ============================================================ */
router.post("/", upload.single("attachment"), async (req, res) => {
  try {
    const {
      type,
      requestType,
      duration,
      dateFrom,
      dateUntil,
      totalDays,
      reason
    } = req.body;

    const user = req.user;

    if (!user || !user.staff_id) {
      return res.status(401).json({ message: "User not attached to request" });
    }

    const staffId = user.staff_id;
    const staffName = user.full_name;
    const department = user.department || null;
    const requesterRole = user.role || "Staff";
    const requesterPosition = user.position;
    const attachmentPath = req.file ? req.file.path : null;

    if (!type || !dateFrom || !dateUntil || !totalDays || !reason) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const sql = `
      INSERT INTO leave_requests (
        staff_id,
        staff_name,
        department,
        requester_role,
        requester_position,
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
        $11,$12,$13,
        'pending', NOW()
      )
      RETURNING *;
    `;

    const params = [
      staffId,
      staffName,
      department,
      requesterRole,
      requesterPosition,
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
   2) GET LEAVE REQUESTS
   GET /api/leave-requests?status=pending
   ============================================================ */
router.get("/", async (req, res) => {
  try {
    const { status } = req.query;

    const sql = `
      SELECT 
        lr.*,
        p.email,
        p.department AS profile_department,
        p.position AS profile_position,
        p.employment_date,
        lr.department AS staff_department,
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
   4) EDIT LEAVE DETAILS
   PATCH /api/leave-requests/:id/edit
   ============================================================ */
router.patch("/:id/edit", async (req, res) => {
  try {
    const leaveId = req.params.id;

    const {
      leave_type,
      duration,
      date_from,
      date_until,
      total_days,
      reason
    } = req.body;

    const sql = `
      UPDATE leave_requests
      SET
        leave_type = $1,
        duration = $2,
        date_from = $3,
        date_until = $4,
        total_days = $5,
        reason = $6
      WHERE leave_id = $7
      RETURNING *;
    `;

    const params = [
      leave_type,
      duration,
      date_from,
      date_until,
      total_days,
      reason,
      leaveId
    ];

    const result = await pool.query(sql, params);

    if (!result.rowCount) {
      return res.status(404).json({ message: "Leave request not found" });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error("PATCH /api/leave-requests/:id/edit error:", err);
    res.status(500).json({ message: "Failed to update leave details" });
  }
});

/* ============================================================
   3) UPDATE STATUS (APPROVE / REJECT / CANCELLATION)
   PATCH /api/leave-requests/:id
   ============================================================ */
router.patch("/:id", async (req, res) => {
  try {
    const { status } = req.body;
    const leaveId = req.params.id;

    if (!["approved", "rejected", "cancellation_pending", "cancelled"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    /* ============================================================
       ✔ APPROVAL LOGIC (ONLY RUN WHEN APPROVED)
    ============================================================ */
    if (status === "approved") {
      const leaveRes = await pool.query(
        `SELECT * FROM leave_requests WHERE leave_id = $1 LIMIT 1`,
        [leaveId]
      );

      if (!leaveRes.rows.length) {
        return res.status(404).json({ message: "Leave request not found" });
      }

      const leave = leaveRes.rows[0];
      const staffId = leave.staff_id;
      const leaveType = leave.leave_type;
      const days = Number(leave.total_days);

      /* ============================================================
         A — Annual Leave / Emergency Leave (AL / EL)
      ============================================================ */
      if (leaveType === "AL" || leaveType === "EL") {
        const p = await pool.query(
          `SELECT leave_entitlement_annual, carry_forward_balance, carry_forward_expiry
           FROM profiles
           WHERE staff_id = $1`,
          [staffId]
        );

        let {
          leave_entitlement_annual,
          carry_forward_balance,
          carry_forward_expiry
        } = p.rows[0];

        const leaveDate = new Date(leave.date_from);
        carry_forward_expiry = carry_forward_expiry ? new Date(carry_forward_expiry) : null;

        if (carry_forward_expiry && leaveDate > carry_forward_expiry) {
          carry_forward_balance = 0;
        }

        let deductCF = 0;
        let deductAL = 0;

        if (carry_forward_balance > 0 && leaveDate <= carry_forward_expiry) {
          if (carry_forward_balance >= days) {
            deductCF = days;
          } else {
            deductCF = carry_forward_balance;
            deductAL = days - carry_forward_balance;
          }
        } else {
          deductAL = days;
        }

        if (deductAL > leave_entitlement_annual) {
          return res.status(400).json({ message: "Insufficient Annual Leave balance" });
        }

        await pool.query(
          `UPDATE profiles
           SET carry_forward_balance = carry_forward_balance - $1,
               leave_entitlement_annual = leave_entitlement_annual - $2
           WHERE staff_id = $3`,
          [deductCF, deductAL, staffId]
        );
      }

      /* ============================================================
         B — Medical Leave (MC)
      ============================================================ */
      else if (leaveType === "MC") {
        const m = await pool.query(
          `SELECT leave_entitlement_medical FROM profiles WHERE staff_id = $1`,
          [staffId]
        );

        if (m.rows[0].leave_entitlement_medical < days) {
          return res.status(400).json({ message: "Insufficient Medical Leave balance" });
        }

        await pool.query(
          `UPDATE profiles
           SET leave_entitlement_medical = leave_entitlement_medical - $1
           WHERE staff_id = $2`,
          [days, staffId]
        );
      }

      /* ============================================================
         C — Special Leave (HOSP, MAT, PAT, MAR, COMP_A, COMP_B)
      ============================================================ */
      else {
        const e = await pool.query(
          `SELECT balance FROM leave_entitlements
           WHERE staff_id = $1 AND leave_type = $2`,
          [staffId, leaveType]
        );

        if (!e.rows.length) {
          return res.status(404).json({ message: "Entitlement not set for this leave type" });
        }

        if (e.rows[0].balance < days) {
          return res.status(400).json({ message: "Insufficient leave balance" });
        }

        await pool.query(
          `UPDATE leave_entitlements
           SET balance = balance - $1
           WHERE staff_id = $2 AND leave_type = $3`,
          [days, staffId, leaveType]
        );
      }
    }

    /* ============================================================
       UPDATE leave_requests STATUS
    ============================================================ */
    const sql = `
      UPDATE leave_requests
      SET status = $1
      WHERE leave_id = $2
      RETURNING *;
    `;

    const result = await pool.query(sql, [status, leaveId]);

    if (!result.rowCount) {
      return res.status(404).json({ message: "Leave request not found" });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error("PATCH /api/leave-requests error:", err);
    res.status(500).json({ message: "Failed to update leave request" });
  }
});


/* ============================================================
   5) DELETE ALL LEAVE REQUESTS FOR A STAFF
   DELETE /api/leave-requests/by-staff/:staffId
   ============================================================ */
router.delete("/by-staff/:staffId", async (req, res) => {
  try {
    const staffId = req.params.staffId;

    await pool.query(
      "DELETE FROM leave_requests WHERE staff_id = $1",
      [staffId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("DELETE by-staff error:", err);
    res.status(500).json({ message: "Failed to delete staff leaves" });
  }
});

/* ============================================================
   6) DELETE ONE LEAVE REQUEST
   DELETE /api/leave-requests/:id
   ============================================================ */
router.delete("/:id", async (req, res) => {
  try {
    const leaveId = req.params.id;

    const result = await pool.query(
      "DELETE FROM leave_requests WHERE leave_id = $1 RETURNING *",
      [leaveId]
    );

    if (!result.rowCount)
      return res.status(404).json({ message: "Not found" });

    res.json({ success: true });

  } catch (err) {
    console.error("DELETE leave error:", err);
    res.status(500).json({ message: "Failed to delete leave" });
  }
});

export default router;
