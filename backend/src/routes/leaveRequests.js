import express from "express";
import pool from "../db.js";
import multer from "multer";

const router = express.Router();

// simpan attachment (kalau ada)
const upload = multer({ dest: "uploads/leave_attachments/" });

/* ============================================================
   🔄 AUTO RECALCULATE ANNUAL LEAVE BASED ON APPROVED REQUESTS
   ============================================================ */
async function recalcAnnualLeave(staffId) {
  try {
    const profile = await pool.query(
      `SELECT 
          leave_entitlement_annual_original,
          carry_forward_balance
       FROM profiles
       WHERE staff_id = $1`,
      [staffId]
    );

    if (!profile.rows.length) return;

    const original = Number(profile.rows[0].leave_entitlement_annual_original || 0);
    const carryForward = Number(profile.rows[0].carry_forward_balance || 0);
    const totalEntitlement = original + carryForward;

    // SUM only approved AL/EL
    const takenQuery = await pool.query(
      `SELECT COALESCE(SUM(total_days), 0) AS taken
       FROM leave_requests
       WHERE staff_id = $1
       AND status = 'approved'
       AND leave_type IN ('AL', 'EL')`,
      [staffId]
    );

    const taken = Number(takenQuery.rows[0].taken || 0);
    const newBalance = totalEntitlement - taken;

    await pool.query(
      `UPDATE profiles
       SET leave_entitlement_annual = $1
       WHERE staff_id = $2`,
      [newBalance, staffId]
    );

    return newBalance;
  } catch (err) {
    console.error("❌ recalcAnnualLeave error:", err);
  }
}

/* ============================================================
   🔄 YEARLY RESET FUNCTION (RUN ONCE PER YEAR)
   ============================================================ */
async function resetAnnualLeaveForNewYear() {
  try {
    const staffList = await pool.query(`
      SELECT staff_id, leave_entitlement_annual, leave_entitlement_annual_original
      FROM profiles
    `);

    const currentYear = new Date().getFullYear();
    const expiryDate = `${currentYear}-03-31`;

    for (const s of staffList.rows) {
      const staffId = s.staff_id;

      // Unused balance last year (max 7)
      const carryForward = Math.min(Number(s.leave_entitlement_annual || 0), 7);

      await pool.query(
        `UPDATE profiles
         SET 
           carry_forward_balance = $1,
           carry_forward_original = $1,
           carry_forward_expiry = $2,
           leave_entitlement_annual = leave_entitlement_annual_original
         WHERE staff_id = $3`,
        [carryForward, expiryDate, staffId]
      );
    }

    console.log("🎉 Yearly leave reset completed.");
    return true;
  } catch (error) {
    console.error("❌ Yearly reset error:", error);
    return false;
  }
}

/* ============================================================
   API: TRIGGER YEARLY RESET (ADMIN)
   POST /api/leave-requests/reset-year
   ============================================================ */
router.post("/reset-year", async (req, res) => {
  const success = await resetAnnualLeaveForNewYear();
  if (success) {
    res.json({ success: true, message: "Yearly leave reset completed." });
  } else {
    res.status(500).json({ success: false, message: "Yearly reset failed." });
  }
});

/* ============================================================
   1) CREATE NEW LEAVE REQUEST
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
        staff_id, staff_name, department,
        requester_role, requester_position,
        leave_type, request_type,
        duration, date_from, date_until,
        total_days, reason, attachment_path,
        status, created_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,
        $8,$9,$10,$11,$12,$13,
        'pending', NOW()
      )
      RETURNING *;
    `;

    const params = [
      staffId, staffName, department,
      requesterRole, requesterPosition,
      type, requestType || "new",
      duration, dateFrom, dateUntil,
      totalDays, reason, attachmentPath
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
   ============================================================ */
router.get("/", async (req, res) => {
  try {
    const { status } = req.query;

    const sql = `
      SELECT 
        lr.*, p.email,
        p.department AS profile_department,
        p.position AS profile_position,
        p.employment_date, lr.department AS staff_department,
        p.confirmation_date, p.termination_date,
        p.gender, p.full_name AS profile_name,
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

    const staffId = result.rows[0].staff_id;

    // AUTO RECALC after editing leave
    // ❌ DO NOT recalc for cancellation_pending
    if (status !== "cancellation_pending") {
      await recalcAnnualLeave(staffId);
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

    // ================= EMPLOYEE REQUESTS CANCELLATION =================
    // STOP FLOW HERE — employee cancellation DOES NOT modify balance
    if (status === "cancellation_pending") {
      await pool.query(`
        UPDATE leave_requests
           SET request_type = 'cancellation_request',
               status = 'cancellation_pending'
         WHERE leave_id = $1
      `, [leaveId]);

      return res.json({
        success: true,
        message: "Cancellation request submitted (awaiting manager approval)"
      });
    }

    // ================= VALIDATE MANAGER ACTION =================
    if (!["approved", "rejected", "cancelled"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    // =============== LOAD THE LEAVE REQUEST ===============
    const leaveRes = await pool.query(
      `SELECT * FROM leave_requests WHERE leave_id = $1`,
      [leaveId]
    );

    if (!leaveRes.rows.length) {
      return res.status(404).json({ message: "Leave request not found" });
    }

    const leave = leaveRes.rows[0];
    const staffId = leave.staff_id;
    const leaveType = leave.leave_type;
    const days = Number(leave.total_days);

    // =============== APPROVE LOGIC ===============
    if (status === "approved") {

      // A — Annual / Emergency
      if (leaveType === "AL" || leaveType === "EL") {
        const p = await pool.query(
          `SELECT leave_entitlement_annual, carry_forward_balance, carry_forward_expiry
             FROM profiles WHERE staff_id = $1`,
          [staffId]
        );

        let {
          leave_entitlement_annual,
          carry_forward_balance,
          carry_forward_expiry
        } = p.rows[0];

        const leaveDate = new Date(leave.date_from);
        carry_forward_expiry = carry_forward_expiry ? new Date(carry_forward_expiry) : null;

        // Carry-forward expired → ignore
        if (carry_forward_expiry && leaveDate > carry_forward_expiry) {
          carry_forward_balance = 0;
        }

        let deductCF = 0;
        let deductAL = 0;

        if (carry_forward_balance > 0 && leaveDate <= carry_forward_expiry) {
          if (carry_forward_balance >= days) deductCF = days;
          else {
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

      // B — Medical Leave
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

      // C — Hospitalization Leave
        else if (leaveType === "HOSP") {

          const h = await pool.query(
            `SELECT balance FROM leave_entitlements
              WHERE staff_id = $1 AND leave_type = 'HOSP'`,
            [staffId]
          );

          if (!h.rows.length) {
            return res.status(404).json({ message: "Hospitalization entitlement not found" });
          }

          if (h.rows[0].balance < days) {
            return res.status(400).json({ message: "Insufficient Hospitalization Leave balance" });
          }

          await pool.query(
            `UPDATE leave_entitlements
              SET balance = balance - $1
            WHERE staff_id = $2 AND leave_type = 'HOSP'`,
            [days, staffId]
          );
        }



      // D — Special Leave
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

    } // END APPROVE


    // =============== CANCELLATION APPROVED (ADD BACK) ===============
    if (status === "cancelled") {

  // A — ANNUAL / EMERGENCY (AL, EL)
  if (leaveType === "AL" || leaveType === "EL") {
    await pool.query(
      `UPDATE profiles
         SET leave_entitlement_annual = leave_entitlement_annual + $1
       WHERE staff_id = $2`,
      [days, staffId]
    );
  }

  // B — MEDICAL
  else if (leaveType === "MC") {
    await pool.query(
      `UPDATE profiles
         SET leave_entitlement_medical = leave_entitlement_medical + $1
       WHERE staff_id = $2`,
      [days, staffId]
    );
  }

  // 🔥 C — HOSPITALIZATION (THIS WAS MISSING)
  else if (leaveType === "HOSP") {
    await pool.query(
      `UPDATE leave_entitlements
        SET balance = balance + $1
      WHERE staff_id = $2 AND leave_type = 'HOSP'`,
      [days, staffId]
    );
  }


  // D — OTHER SPECIAL LEAVES
  else {
    await pool.query(
      `UPDATE leave_entitlements
         SET balance = balance + $1
       WHERE staff_id = $2 AND leave_type = $3`,
      [days, staffId, leaveType]
    );
  }
}

    // =============== UPDATE STATUS ===============
    const updated = await pool.query(
      `UPDATE leave_requests
         SET status = $1
       WHERE leave_id = $2
       RETURNING *;`,
      [status, leaveId]
    );

   // ❌ DO NOT recalc for cancellation_pending (employee request)
  if (status !== "cancellation_pending") {
    await recalcAnnualLeave(staffId);
  }


    res.json(updated.rows[0]);

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

    // Recalculate leave after mass delete
    await recalcAnnualLeave(staffId);

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

    const find = await pool.query(
      "SELECT staff_id FROM leave_requests WHERE leave_id = $1",
      [leaveId]
    );

    if (!find.rows.length) {
      return res.status(404).json({ message: "Leave request not found" });
    }

    const staffId = find.rows[0].staff_id;

    const result = await pool.query(
      "DELETE FROM leave_requests WHERE leave_id = $1 RETURNING *",
      [leaveId]
    );

    if (!result.rowCount)
      return res.status(404).json({ message: "Leave request not found" });

    // Auto recalc after delete
    await recalcAnnualLeave(staffId);

    res.json({ success: true });

  } catch (err) {
    console.error("DELETE leave error:", err);
    res.status(500).json({ message: "Failed to delete leave" });
  }
});

/* ============================================================
   7) FORCE RECALCULATE ANNUAL LEAVE BALANCE
   POST /api/leave-requests/recalculate/:staffId
   ============================================================ */
router.post("/recalculate/:staffId", async (req, res) => {
  try {
    const staffId = req.params.staffId;

    const newBalance = await recalcAnnualLeave(staffId);

    res.json({
      success: true,
      message: "Annual leave recalculated successfully",
      staffId: staffId,
      newBalance: newBalance
    });

  } catch (err) {
    console.error("RECALCULATE error:", err);
    res.status(500).json({ message: "Failed to recalculate leave" });
  }
});

/* ============================================================
   8) LEAVE HISTORY
   Admin = all
   Manager = only department
   GET /api/leave-history
   ============================================================ */
router.get("/history/all", async (req, res) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ message: "Unauthorised" });
    }

    const role = user.role;
    const dept = user.department;

    let sql = `
      SELECT
        lr.leave_id,
        lr.staff_id,
        lr.staff_name,
        lr.department,
        lr.leave_type,
        lr.status,
        lr.total_days,
        lr.date_from,
        lr.date_until,
        lr.created_at,
        p.photourl,
        p.position
      FROM leave_requests lr
      LEFT JOIN profiles p
        ON p.staff_id = lr.staff_id
    `;

    let params = [];

    if (role === "Manager") {
      sql += ` WHERE lr.department = $1 `;
      params.push(dept);
    }

    sql += ` ORDER BY lr.date_from DESC;`;

    const result = await pool.query(sql, params);

    res.json(result.rows);
  } catch (err) {
    console.error("GET /api/leave-history error:", err);
    res.status(500).json({ message: "Failed to load leave history" });
  }
});
/* ============================================================
   GET LEAVE REQUESTS FOR LOGGED-IN USER ONLY
   GET /api/leave-requests/me
   ============================================================ */
router.get("/me", async (req, res) => {
  try {
    const user = req.user;
    if (!user || !user.staff_id) {
      return res.status(401).json({ message: "Unauthorised" });
    }

    const result = await pool.query(
      `SELECT *
       FROM leave_requests
       WHERE staff_id = $1
       ORDER BY date_from ASC`,
      [user.staff_id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("GET /api/leave-requests/me error:", err);
    res.status(500).json({ message: "Failed to load your leave data" });
  }
});


router.get("/me", async (req, res) => {
  try {
    const user = req.user;
    if (!user || !user.staff_id) {
      return res.status(401).json({ message: "Unauthorised" });
    }

    const result = await pool.query(
      `SELECT *
       FROM leave_requests
       WHERE staff_id = $1
       ORDER BY date_from ASC`,
      [user.staff_id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("GET /api/leave-requests/me error:", err);
    res.status(500).json({ message: "Failed to load your leave data" });
  }
});

export default router;
