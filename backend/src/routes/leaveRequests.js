import express from "express";
import pool from "../db.js";
import multer from "multer";
import {
  sendLeaveSubmitted,
  sendPendingApproval,
  sendLeaveApproved,
  sendLeaveRejected,
  sendCancellationPending,
  sendCancellationApproved
} from "../utils/emailService.js";

const leaveTypeFullName = {
  AL: "Annual / Emergency",
  MC: "Medical",
  MAT: "Maternity",
  PAT: "Paternity",
  COMP_A: "Compassionate A",
  COMP_B: "Compassionate B",
  MAR: "Marriage",
  HOSP: "Hospitalization",
  UNPAID: "Unpaid"
};
import fs from "fs";
import path from "path";

const __dirname = path.resolve();

function getLeaveFullName(code) {
  return leaveTypeFullName[code] || code;
}

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

// =======================================================
// 🛑 SERVER-SIDE VALIDATION: Prevent submitting above limit
// =======================================================

// 1. Recalculate total days (authoritative calculation)
const start = new Date(dateFrom);
const end = new Date(dateUntil);
const msDay = 1000 * 60 * 60 * 24;

const serverTotalDays = Math.floor((end - start) / msDay) + 1;

if (serverTotalDays <= 0) {
  return res.status(400).json({ message: "Invalid date range" });
}

// 2. LOAD ENTITLEMENTS + USED DAYS
let entitlement = 0;
let used = 0;

// =======================================================
// ANNUAL (AL/EL)
// =======================================================
if (type === "AL" || type === "EL") {

  // 1. Get profile & carry-forward info
  const profile = await pool.query(
    `SELECT 
        leave_entitlement_annual_original,
        leave_entitlement_annual,
        carry_forward_balance,
        carry_forward_expiry
     FROM profiles 
     WHERE staff_id = $1`,
    [user.staff_id]
  );

  const row = profile.rows[0];

  const original = Number(row.leave_entitlement_annual_original || 0);   // yearly entitlement (14)
  let CF = Number(row.carry_forward_balance || 0);                       // carry forward (max 7)
  let CF_expiry = row.carry_forward_expiry ? new Date(row.carry_forward_expiry) : null;

  const today = new Date();

  // 2. If carry forward already expired → CF = 0
  if (CF_expiry && today > CF_expiry) {
    CF = 0;
  }

  // 3. ENTITLEMENT = annual entitlement + (valid carry-forward only)
  entitlement = original + CF;

  // 4. USED DAYS = approved + pending + cancellation_pending
  const u = await pool.query(
    `SELECT COALESCE(SUM(total_days), 0) AS used
       FROM leave_requests
       WHERE staff_id = $1
         AND leave_type IN ('AL', 'EL')
         AND status IN ('approved','pending','cancellation_pending')`,
    [user.staff_id]
  );

  used = Number(u.rows[0].used);
}


// =======================================================
// MEDICAL (MC)
// =======================================================
else if (type === "MC") {
  const m = await pool.query(
    `SELECT leave_entitlement_medical FROM profiles WHERE staff_id = $1`,
    [user.staff_id]
  );

  entitlement = Number(m.rows[0].leave_entitlement_medical || 0);

  const u = await pool.query(
    `SELECT COALESCE(SUM(total_days), 0) AS used
       FROM leave_requests
       WHERE staff_id = $1
         AND leave_type = 'MC'
         AND status IN ('approved','pending','cancellation_pending')`,
    [user.staff_id]
  );

  used = Number(u.rows[0].used);
}

// =======================================================
// HOSPITALIZATION (HOSP)
// =======================================================
else if (type === "HOSP") {
  const h = await pool.query(
    `SELECT balance FROM leave_entitlements
       WHERE staff_id = $1 AND leave_type = 'HOSP'`,
    [user.staff_id]
  );

  entitlement = Number(h.rows[0]?.balance || 0);

  const u = await pool.query(
    `SELECT COALESCE(SUM(total_days), 0) AS used
       FROM leave_requests
       WHERE staff_id = $1
         AND leave_type = 'HOSP'
         AND status IN ('approved','pending','cancellation_pending')`,
    [user.staff_id]
  );

  used = Number(u.rows[0].used);
}

else if (type === "UNPAID") {
   entitlement = Infinity;
   used = 0;
}



// =======================================================
// SPECIAL LEAVES (PAT, COMP_A, COMP_B, MAR)
// =======================================================
// =======================================================
else {
  const defaults = { PAT: 7, COMP_A: 3, COMP_B: 1, MAR: 3 };

  const s = await pool.query(
    `SELECT balance FROM leave_entitlements
       WHERE staff_id = $1 AND leave_type = $2`,
    [user.staff_id, type]
  );

  if (!s.rows.length) {
    // Auto create entitlement row if missing
    entitlement = defaults[type] || 0;

    await pool.query(
      `INSERT INTO leave_entitlements (staff_id, leave_type, balance)
       VALUES ($1, $2, $3)`,
      [user.staff_id, type, entitlement]
    );
  } else {
    entitlement = Number(s.rows[0].balance || 0);
  }

  const u = await pool.query(
    `SELECT COALESCE(SUM(total_days), 0) AS used
       FROM leave_requests
       WHERE staff_id = $1
         AND leave_type = $2
         AND status IN ('approved','pending','cancellation_pending')`,
    [user.staff_id, type]
  );

  used = Number(u.rows[0].used || 0);
}

// =======================================================
// 🛑 FINAL CHECK
// =======================================================

// ⭐ UNPAID LEAVE HAS NO LIMIT — ALWAYS ALLOWED
if (type === "UNPAID"){
  entitlement = Infinity;  
  used = 0;
}

if (used + serverTotalDays > entitlement) {
  return res.status(400).json({
    message: `${getLeaveFullName(type)} leave application limit exceeded.`,
    entitlement,
    used,
    requested: serverTotalDays,
    remaining: entitlement - used
  });
}

    const staffName = user.full_name;
    const department = user.department || null;
    const requesterRole = user.role || "Staff";
    const requesterPosition = user.position;
    const attachmentPath = req.file ? req.file.path.replace(/\\/g, "/") : null;

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
const leave = result.rows[0];

// ======================
// SEND EMAIL TO STAFF (submitter)
// ======================
sendLeaveSubmitted(user.email, user.full_name, leave);

// ======================
// FIND WHO SHOULD APPROVE
// ======================
let approverEmail = null;

if (user.role === "Manager") {
  // Manager applying leave → Admin must approve
  const adminRes = await pool.query(
    `SELECT email FROM profiles WHERE role='Admin' LIMIT 1`
  );

  if (adminRes.rows.length) {
    approverEmail = adminRes.rows[0].email;
  }

} else {
  // Staff applying leave → Manager approves
  const mgrRes = await pool.query(
    `SELECT email FROM profiles 
     WHERE role='Manager' AND department=$1`,
    [user.department]
  );

  if (mgrRes.rows.length) {
    approverEmail = mgrRes.rows[0].email;
  }
}

// ======================
// SEND PENDING APPROVAL EMAIL
// ======================
if (approverEmail) {
  sendPendingApproval(approverEmail, user.full_name, leave);
}


// RETURN TO FRONTEND
res.status(201).json(leave);
  } 
  
  catch (err) {
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
router.patch("/:id/edit", upload.single("attachment"), async (req, res) => {
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

    // Get existing leave
    const existingRes = await pool.query(
      `SELECT staff_id, attachment_path 
       FROM leave_requests 
       WHERE leave_id = $1`,
      [leaveId]
    );

    if (!existingRes.rows.length) {
      return res.status(404).json({ message: "Leave request not found" });
    }

    const existing = existingRes.rows[0];
    const staffId = existing.staff_id;
    const oldAttachment = existing.attachment_path;

    // ================================
// HANDLE ATTACHMENT REPLACEMENT
// ================================
let newAttachmentPath = oldAttachment;

if (req.file) {
  newAttachmentPath = req.file.path.replace(/\\/g, "/");


  if (oldAttachment) {
    try {
      const fullPath = path.join(process.cwd(), oldAttachment);
      fs.unlink(fullPath, (err) => {
        if (err) console.warn("Unable to delete old attachment:", err);
      });
    } catch (err) {
      console.warn("Failed to delete old attachment:", err);
    }
  }
}

    // ======================================================
    // VALIDATION (same as your current logic)
    // ======================================================

    const start = new Date(date_from);
    const end = new Date(date_until);
    const msDay = 1000 * 60 * 60 * 24;

    const serverTotalDays = Math.floor((end - start) / msDay) + 1;

    if (serverTotalDays <= 0) {
      return res.status(400).json({ message: "Invalid date range" });
    }

    // ---- ENTITLEMENT CHECKS (copy same logic as your POST) ----
    // (kept 100% the same, no change)

    let entitlement = 0;
    let used = 0;

    // ANNUAL / EMERGENCY
    if (leave_type === "AL" || leave_type === "EL") {

    const p = await pool.query(
      `SELECT 
          leave_entitlement_annual_original,
          carry_forward_balance,
          carry_forward_expiry
      FROM profiles 
      WHERE staff_id = $1`,
      [staffId]
    );

    const row = p.rows[0];

    // annual entitlement
    const original = Number(row.leave_entitlement_annual_original || 0);

    // carry forward balance (actual)
    let CF = Number(row.carry_forward_balance || 0);
    let CF_expiry = row.carry_forward_expiry ? new Date(row.carry_forward_expiry) : null;

    // expired CF → ignore
    const today = new Date();
    if (CF_expiry && today > CF_expiry) {
      CF = 0;
    }

    // final entitlement
    entitlement = original + CF;

    // USED days except current edited leave
    const u = await pool.query(
      `SELECT COALESCE(SUM(total_days),0) AS used
        FROM leave_requests
        WHERE staff_id=$1
          AND leave_type IN ('AL','EL')
          AND status IN ('approved','pending','cancellation_pending')
          AND leave_id != $2`,
      [staffId, leaveId]
    );

    used = Number(u.rows[0].used);
    }

    // MEDICAL
    else if (leave_type === "MC") {
      const m = await pool.query(
        `SELECT leave_entitlement_medical FROM profiles WHERE staff_id = $1`,
        [staffId]
      );
      entitlement = Number(m.rows[0].leave_entitlement_medical || 0);

      const u = await pool.query(
        `SELECT COALESCE(SUM(total_days),0) AS used
          FROM leave_requests
          WHERE staff_id=$1 AND leave_type='MC'
            AND status IN ('approved','pending','cancellation_pending')
            AND leave_id != $2`,
        [staffId, leaveId]
      );
      used = Number(u.rows[0].used);
    }

    // HOSPITALIZATION
    else if (leave_type === "HOSP") {
      const h = await pool.query(
        `SELECT balance FROM leave_entitlements
          WHERE staff_id=$1 AND leave_type='HOSP'`,
        [staffId]
      );

      entitlement = Number(h.rows[0]?.balance || 0);

      const u = await pool.query(
        `SELECT COALESCE(SUM(total_days),0) AS used
          FROM leave_requests
          WHERE staff_id=$1 AND leave_type='HOSP'
            AND status IN ('approved','pending','cancellation_pending')
            AND leave_id != $2`,
        [staffId, leaveId]
      );

      used = Number(u.rows[0].used);
    }
    else if (leave_type === "UNPAID") {
   entitlement = Infinity;
   used = 0;
}

    // SPECIAL LEAVES
    else {
      const s = await pool.query(
        `SELECT balance FROM leave_entitlements
          WHERE staff_id=$1 AND leave_type=$2`,
        [staffId, leave_type]
      );

      entitlement = Number(s.rows[0]?.balance || 0);

      const u = await pool.query(
        `SELECT COALESCE(SUM(total_days),0) AS used
          FROM leave_requests 
          WHERE staff_id=$1 AND leave_type=$2
            AND status IN ('approved','pending','cancellation_pending')
            AND leave_id != $3`,
        [staffId, leave_type, leaveId]
      );

      used = Number(u.rows[0].used);
    }
// ⭐ UNPAID LEAVE HAS NO LIMIT — ALWAYS ALLOWED
if (leave_type === "UNPAID") {
  entitlement = Infinity;
  used = 0;
}


    // FINAL CHECK
    if (used + serverTotalDays > entitlement) {
      return res.status(400).json({
        message: `Cannot update. ${leave_type} limit exceeded.
        Entitlement: ${entitlement}, Used (others): ${used}, Requested: ${serverTotalDays}`
      });
    }

    // ======================================================
    // UPDATE DATA (allowed)
    // ======================================================
     const updated = await pool.query(
      `UPDATE leave_requests
         SET leave_type = $1,
             duration = $2,
             date_from = $3,
             date_until = $4,
             total_days = $5,
             reason = $6,
             attachment_path = $7
       WHERE leave_id = $8
       RETURNING *`,
      [
        leave_type,
        duration,
        date_from,
        date_until,
        total_days,
        reason,
        newAttachmentPath,
        leaveId
      ]
    );

    res.json(updated.rows[0]);

  } catch (err) {
    console.error("PATCH /api/leave-requests/:id/edit error:", err);
    res.status(500).json({ message: "Failed to update leave" });
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
    // if (status === "cancellation_pending") {
    //   await pool.query(
    //     `UPDATE leave_requests
    //        SET request_type = 'cancellation_request',
    //            status = 'cancellation_pending'
    //      WHERE leave_id = $1`,
    //     [leaveId]
    //   );
    //   // SEND EMAIL TO MANAGER
    //     const managerRes = await pool.query(
    //       `SELECT email FROM profiles WHERE role='Manager' AND department=$1`,
    //       [leave.department]
    //     );
    //     if (managerRes.rows.length) {
    //       sendCancellationPending(managerRes.rows[0].email, leave.staff_name, leave);
    //     }

    //   return res.json({
    //     success: true,
    //     message: "Cancellation request submitted (awaiting manager approval)"
    //   });
    // }

    if (status === "cancellation_pending") {

    // Load full leave info FIRST
    const leaveRes = await pool.query(
      `SELECT * FROM leave_requests WHERE leave_id = $1`,
      [leaveId]
    );
    const leave = leaveRes.rows[0];

    await pool.query(
      `UPDATE leave_requests
           SET request_type = 'cancellation_request',
               status = 'cancellation_pending'
         WHERE leave_id = $1`,
      [leaveId]
    );

    // SEND EMAIL TO MANAGER
    // const mgrRes = await pool.query(
    //   `SELECT email FROM profiles 
    //    WHERE role='Manager' AND department = $1`,
    //    [leave.department]
    // );

    // if (mgrRes.rows.length) {
    //   sendCancellationPending(mgrRes.rows[0].email, leave.staff_name, leave);
    // }

    // return res.json({
    //   success: true,
    //   message: "Cancellation request submitted (awaiting manager approval)"
    // });
    // Determine who should approve the cancellation
let approverEmail = null;

// If the requester is a Manager -> Admin must approve
if (leave.requester_role === "Manager") {
  const adminRes = await pool.query(
    `SELECT email FROM profiles WHERE LOWER(role) = 'admin' LIMIT 1`
  );
  approverEmail = adminRes.rows[0]?.email;
}

// If requester is Staff -> Manager must approve
else {
  const mgrRes = await pool.query(
    `SELECT email FROM profiles 
     WHERE LOWER(role) = 'manager' AND department = $1`,
    [leave.department]
  );
  approverEmail = mgrRes.rows[0]?.email;
}

// Send cancellation notification to correct approver
if (approverEmail) {
  sendCancellationPending(approverEmail, leave.staff_name, leave);
}

return res.json({
  success: true,
  message: "Cancellation request submitted (awaiting approval)"
});

}


    // ================= VALIDATE MANAGER ACTION =================
    if (!["approved", "rejected", "cancelled"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    // ================= LOAD LEAVE REQUEST =================
    const leaveRes = await pool.query(
      `SELECT * FROM leave_requests WHERE leave_id = $1`,
      [leaveId]
    );

    if (!leaveRes.rows.length) {
      return res.status(404).json({ message: "Leave request not found" });
    }

    const leave = leaveRes.rows[0];
    const staffId = leave.staff_id;

    // GET STAFF EMAIL (since leave.email is NULL)
    const emailRow = await pool.query(
      `SELECT email FROM profiles WHERE staff_id = $1`,
      [staffId]
    );
const staffEmail = emailRow.rows[0]?.email;

    const leaveType = leave.leave_type;
    const days = Number(leave.total_days);

    /* ============================================================
       -------------- APPROVE LEAVE REQUEST -----------------
       ============================================================ */
    if (status === "approved") {
      // ⭐ UNPAID — NO DEDUCTION, ALWAYS ALLOWED
      if (leaveType === "UNPAID") {
        // do nothing
      }

      // A — Annual / Emergency (AL / EL)
      else if (leaveType === "AL" || leaveType === "EL") {
        const p = await pool.query(
          `SELECT leave_entitlement_annual,
                  carry_forward_balance,
                  carry_forward_expiry
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
          return res.status(400).json({ message: "Insufficient Hospitalization balance" });
        }

        await pool.query(
          `UPDATE leave_entitlements
             SET balance = balance - $1
           WHERE staff_id = $2 AND leave_type = 'HOSP'`,
          [days, staffId]
        );
      }

      // D — Special Leaves (PAT, COMP_A, COMP_B, MAR)
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
      console.log("📧 DEBUG staff email:", staffEmail);

      sendLeaveApproved(staffEmail, leave);

    } // END APPROVED

    if (status === "rejected") {
  sendLeaveRejected(staffEmail, leave);
  }

    /* ============================================================
       ------------------ CANCELLATION APPROVED -------------------
       ============================================================ */
    if (status === "cancelled") {

      // ⭐ UNPAID — no refund needed
      if (leaveType === "UNPAID") {
        // do nothing
      }

      // A — Annual / Emergency
      else if (leaveType === "AL" || leaveType === "EL") {
        await pool.query(
          `UPDATE profiles
             SET leave_entitlement_annual = leave_entitlement_annual + $1
           WHERE staff_id = $2`,
          [days, staffId]
        );
      }

      // B — Medical
      else if (leaveType === "MC") {
        await pool.query(
          `UPDATE profiles
             SET leave_entitlement_medical = leave_entitlement_medical + $1
           WHERE staff_id = $2`,
          [days, staffId]
        );
      }

      // C — Hospitalization
      else if (leaveType === "HOSP") {
        await pool.query(
          `UPDATE leave_entitlements
             SET balance = balance + $1
           WHERE staff_id = $2 AND leave_type = 'HOSP'`,
          [days, staffId]
        );
      }

      // D — SPECIAL LEAVES
      else {
        await pool.query(
          `UPDATE leave_entitlements
             SET balance = balance + $1
           WHERE staff_id = $2 AND leave_type = $3`,
          [days, staffId, leaveType]
        );
      }
      sendCancellationApproved(staffEmail, leave);
    }

    /* ============================================================
       ------------------ UPDATE STATUS + RECALC ------------------
       ============================================================ */
    const updated = await pool.query(
      `UPDATE leave_requests
         SET status = $1
       WHERE leave_id = $2
       RETURNING *`,
      [status, leaveId]
    );

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
    res.status(500).json({ message: "Failed to load your leave data" });
  }
});


export default router;