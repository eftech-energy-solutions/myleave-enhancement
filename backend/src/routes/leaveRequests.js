import express from "express";
import pool from "../db.js";
import multer from "multer";
import cron from "node-cron";
import { calculateWorkingDays } from "../utils/calculateWorkingDays.js";
import {
  sendLeaveSubmitted,
  sendPendingApproval,
  sendLeaveApproved,
  sendLeaveRejected,
  sendCancellationPending,
  sendCancellationApproved
} from "../utils/emailService.js";
import { logAdminAction } from '../middleware/adminLogger.js';

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
const upload = multer({ dest: "uploads/leave_attachments/" });

/* ============================================================
    YEARLY RESET
============================================================ */
async function resetAnnualLeaveForNewYear() {
  try {
    const staffList = await pool.query(`
      SELECT staff_id, leave_entitlement_annual, leave_entitlement_annual_original
      FROM profiles
    `);
    const currentYear = new Date().getFullYear();
    const expiryDate = `${currentYear + 1}-03-31`;

    for (const s of staffList.rows) {
      const carryForward = Math.min(Number(s.leave_entitlement_annual || 0), 7);

      await pool.query(
        `UPDATE profiles
          SET 
            carry_forward_balance = $1::numeric,
            carry_forward_original = $1::numeric,
            carry_forward_expiry = $2,
            leave_entitlement_annual = leave_entitlement_annual_original,
            remaining_leave = leave_entitlement_annual_original + $1::numeric
          WHERE staff_id = $3`,
        [carryForward, expiryDate, s.staff_id]
      );
    }

    return true;
  } catch (err) {
    console.error("resetAnnualLeaveForNewYear error:", err);
    return false;
  }
}

async function updateRemainingLeave(staffId) {
  const r = await pool.query(
    `SELECT leave_entitlement_annual, carry_forward_balance, carry_forward_expiry
     FROM profiles WHERE staff_id = $1`,
    [staffId]
  );

  let AL = Number(r.rows[0].leave_entitlement_annual || 0);
  let CF = Number(r.rows[0].carry_forward_balance || 0);
  let expiry = r.rows[0].carry_forward_expiry ? new Date(r.rows[0].carry_forward_expiry) : null;

  const today = new Date();
  if (expiry && today > expiry) CF = 0;

  const remaining = AL + CF;

  await pool.query(
    `UPDATE profiles SET remaining_leave = $1 WHERE staff_id = $2`,
    [remaining, staffId]
  );
}
// ============================================================
// MARK APPROVED LEAVES AS INVALID IF TOTAL_DAYS = 0
// ============================================================
async function markInvalidApprovedLeaves() {
  try {
    const result = await pool.query(`
      UPDATE leave_requests
      SET status = 'invalid'
      WHERE status = 'approved'
        AND total_days <= 0
      RETURNING leave_id
    `);

    if (result.rows.length) {
      console.log(
        `⚠️ Marked ${result.rows.length} approved leave(s) as INVALID due to zero total_days`
      );
    }
  } catch (err) {
    console.error("❌ Failed to mark invalid approved leaves:", err);
  }
}
// ============================================================
// FORCE RECALC + MARK INVALID (FOR FRONTEND REFRESH)
// ============================================================
router.post("/recalc-invalid", async (req, res) => {
  try {
    await markInvalidApprovedLeaves();
    return res.json({ success: true });
  } catch (err) {
    console.error("Recalc invalid error:", err);
    return res.status(500).json({ success: false });
  }
});


/* ============================================================
    API — TRIGGER RESET
============================================================ */
router.post("/reset-year", async (req, res) => {
  const ok = await resetAnnualLeaveForNewYear();
  return ok
    ? res.json({ success: true })
    : res.status(500).json({ success: false });
});

/* ============================================================
    CREATE NEW LEAVE REQUEST (WITH OVERLAP CHECK)
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
    if (!user || !user.staff_id)
      return res.status(401).json({ message: "Unauthorised" });

    const staffId = user.staff_id;

    let serverDays;
    if (duration === 'Half') {
      serverDays = 0.5;
    } else {
      serverDays = await calculateWorkingDays(dateFrom, dateUntil);
    }
    
    if (serverDays <= 0)
      return res.status(400).json({ message: "Invalid date range or no working days" });

    // ✅ CHECK FOR OVERLAPPING DATES FIRST (BACKEND VALIDATION)
    const overlapCheck = await pool.query(
      `SELECT date_from, date_until FROM leave_requests
       WHERE staff_id = $1
       AND status IN ('pending', 'approved', 'cancellation_pending')
       AND (
         (date_from <= $2 AND date_until >= $2) OR
         (date_from <= $3 AND date_until >= $3) OR
         (date_from >= $2 AND date_until <= $3)
       )`,
      [staffId, dateFrom, dateUntil]
    );

    if (overlapCheck.rows.length > 0) {
      return res.status(400).json({
        message: "You have already applied for leave on one or more dates in this range. Please check your existing applications."
      });
    }

    // LOAD ENTITLEMENT + USED
    let entitlement = 0;
    let used = 0;

    // ===== UNPAID LEAVE (NO LIMITS, NO DB TRACKING) =====
    if (type === "UNPAID") {
      entitlement = Infinity;
      used = 0;
    }

    // ===== ANNUAL / EMERGENCY =====
    else if (type === "AL" || type === "EL") {
      const p = await pool.query(
        `SELECT leave_entitlement_annual, carry_forward_balance, carry_forward_expiry
         FROM profiles WHERE staff_id=$1`,
        [staffId]
      );

      const row = p.rows[0];
      let AL = Number(row.leave_entitlement_annual || 0);
      let CF = Number(row.carry_forward_balance || 0);

      const expiry = row.carry_forward_expiry
        ? new Date(row.carry_forward_expiry)
        : null;

      if (expiry && new Date() > expiry) CF = 0;

      entitlement = AL + CF;

      const u = await pool.query(
        `SELECT COALESCE(SUM(total_days),0) AS used
         FROM leave_requests
         WHERE staff_id=$1 AND leave_type IN ('AL','EL')
           AND status IN ('approved','pending','cancellation_pending')`,
        [staffId]
      );

      used = Number(u.rows[0].used);
    }

    // ===== MEDICAL =====
    else if (type === "MC") {
      const m = await pool.query(
        `SELECT leave_entitlement_medical FROM profiles WHERE staff_id=$1`,
        [staffId]
      );

      entitlement = Number(m.rows[0].leave_entitlement_medical || 0);

      const u = await pool.query(
        `SELECT COALESCE(SUM(total_days),0) AS used
         FROM leave_requests
         WHERE staff_id=$1 AND leave_type='MC'
           AND status IN ('approved','pending','cancellation_pending')`,
        [staffId]
      );
      used = Number(u.rows[0].used);
    }

    // ===== HOSPITALIZATION =====
    else if (type === "HOSP") {
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
           AND status IN ('approved','pending','cancellation_pending')`,
        [staffId]
      );
      used = Number(u.rows[0].used);
    }

    // ===== SPECIAL LEAVES =====
    else {
      const s = await pool.query(
        `SELECT balance FROM leave_entitlements
         WHERE staff_id=$1 AND leave_type=$2`,
        [staffId, type]
      );

      entitlement = Number(s.rows[0]?.balance || 0);

      const u = await pool.query(
        `SELECT COALESCE(SUM(total_days),0) AS used
         FROM leave_requests
         WHERE staff_id=$1 AND leave_type=$2
           AND status IN ('approved','pending','cancellation_pending')`,
        [staffId, type]
      );
      used = Number(u.rows[0].used);
    }

    // FINAL CHECK
    if (used + serverDays > entitlement) {
      return res.status(400).json({
        message: `${getLeaveFullName(type)} leave application limit exceeded.`,
        entitlement,
        used,
        requested: serverDays,
        remaining: entitlement - used
      });
    }

    const attachmentPath = req.file ? req.file.path : null;

    const result = await pool.query(
      `INSERT INTO leave_requests (
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
      RETURNING *`,
      [
        staffId,
        user.full_name,
        user.department,
        user.role,
        user.position,
        type,
        requestType || "new",
        duration,
        dateFrom,
        dateUntil,
        serverDays,
        reason,
        attachmentPath
      ]
    );

    const leave = result.rows[0];

    // Send emails...
    sendLeaveSubmitted(user.email, user.full_name, leave);

    let approverEmail = null;
    if (user.role === "Manager") {
      const adminRes = await pool.query(
        `SELECT email FROM profiles WHERE role='Admin' LIMIT 1`
      );
      if (adminRes.rows.length) {
        approverEmail = adminRes.rows[0].email;
      }
    } else {
      const mgrRes = await pool.query(
        `SELECT email FROM profiles 
         WHERE role='Manager' AND department=$1`,
        [user.department]
      );
      if (mgrRes.rows.length) {
        approverEmail = mgrRes.rows[0].email;
      }
    }

    if (approverEmail) {
      sendPendingApproval(approverEmail, user.full_name, leave);
    }

    return res.status(201).json(leave);

  } catch (err) {
    console.error("POST /api/leave-requests error:", err);
    return res.status(500).json({ message: "Failed to create leave request" });
  }
});

/* ============================================================
    GET ALL LEAVE REQUESTS
============================================================ */
router.get("/", async (req, res) => {
  try {
    const { status } = req.query;

    const sql = `
      SELECT 
        lr.*, p.email,
        p.department AS profile_department,
        p.position AS profile_position,
        p.employment_date,
        p.confirmation_date, p.termination_date,
        p.gender, p.full_name AS profile_name,
        p.photourl AS photo_url,
        p.leave_entitlement_annual,
        p.leave_entitlement_medical,
        p.notes
      FROM leave_requests lr
      LEFT JOIN profiles p ON p.staff_id = lr.staff_id
      ${status ? "WHERE lr.status = $1" : ""}
      ORDER BY lr.created_at DESC
    `;

    const result = await pool.query(sql, status ? [status] : []);
    return res.json(result.rows);
  } catch (err) {
    console.error("GET /leave-requests error:", err);
    return res.status(500).json({ message: "Failed to load requests" });
  }
});

/* ============================================================
   EDIT LEAVE DETAILS (FIXED OVERLAP CHECK)
   PATCH /api/leave-requests/:id/edit
   ============================================================ */
router.patch("/:id/edit", upload.single("attachment"), async (req, res) => {
  try {
    const leaveId = req.params.id;
    const { leave_type, duration, date_from, date_until, total_days, reason } =
      req.body;

    const find = await pool.query(
      `SELECT * FROM leave_requests WHERE leave_id=$1`,
      [leaveId]
    );

    if (!find.rows.length)
      return res.status(404).json({ message: "Leave not found" });

    const staffId = find.rows[0].staff_id;

    let serverDays;
    if (duration === 'Half') {
      serverDays = 0.5;
    } else {
      serverDays = await calculateWorkingDays(date_from, date_until);
    }
    
    if (serverDays <= 0)
      return res.status(400).json({ message: "Invalid date range or no working days" });

    // ✅ CHECK FOR OVERLAPPING DATES (excluding current leave being edited)
    const overlapCheck = await pool.query(
      `SELECT date_from, date_until FROM leave_requests
       WHERE staff_id = $1
       AND leave_id != $2
       AND status IN ('pending', 'approved', 'cancellation_pending')
       AND (
         (date_from <= $3 AND date_until >= $3) OR
         (date_from <= $4 AND date_until >= $4) OR
         (date_from >= $3 AND date_until <= $4)
       )`,
      [staffId, leaveId, date_from, date_until]
    );

    if (overlapCheck.rows.length > 0) {
      return res.status(400).json({
        message: "You have already applied for leave on one or more dates in this range. Please check your existing applications."
      });
    }

    // ---- ENTITLEMENT CHECKS ----
    let entitlement = 0;
    let used = 0;

    // ===== UNPAID LEAVE (NO LIMITS) =====
    if (leave_type === "UNPAID") {
      entitlement = Infinity;
      used = 0;
    }

    // ====== ANNUAL / EMERGENCY ======
    else if (leave_type === "AL" || leave_type === "EL") {
      const p = await pool.query(
        `SELECT leave_entitlement_annual, carry_forward_balance, carry_forward_expiry
         FROM profiles WHERE staff_id=$1`,
        [staffId]
      );

      let AL = Number(p.rows[0].leave_entitlement_annual);
      let CF = Number(p.rows[0].carry_forward_balance);

      const expiry = p.rows[0].carry_forward_expiry
        ? new Date(p.rows[0].carry_forward_expiry)
        : null;

      if (expiry && new Date() > expiry) CF = 0;

      entitlement = AL + CF;

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

    // ===== MEDICAL =====
    else if (leave_type === "MC") {
      const m = await pool.query(
        `SELECT leave_entitlement_medical FROM profiles WHERE staff_id=$1`,
        [staffId]
      );
      entitlement = Number(m.rows[0].leave_entitlement_medical);

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

    // ===== HOSPITALIZATION =====
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

    // ===== SPECIAL LEAVES =====
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

    if (used + serverDays > entitlement) {
      return res.status(400).json({
        message: `Cannot update. ${leave_type} limit exceeded.`,
        entitlement,
        used,
        requested: serverDays
      });
    }

    // ======================================================
    // UPDATE DATA (allowed)
    // ======================================================
    const newAttachmentPath = req.file ? req.file.path : find.rows[0].attachment_path;

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
    
    return res.json(updated.rows[0]);
  } catch (err) {
    console.error("PATCH /api/leave-requests/:id/edit error:", err);
    res.status(500).json({ message: "Failed to update leave" });
  }
});

/* ============================================================
    APPROVE / REJECT / CANCEL LOGIC
============================================================ */
router.patch("/:id", async (req, res) => {
  console.log("🔥🔥 ROUTE TRIGGERED: PATCH /api/leave-requests/" + req.params.id);

  try {
    const { status } = req.body;
    const leaveId = req.params.id;

    // EMPLOYEE REQUESTS CANCEL
    if (status === "cancellation_pending") {
      await pool.query(
        `UPDATE leave_requests
         SET request_type='cancellation_request', status='cancellation_pending'
         WHERE leave_id=$1`,
        [leaveId]
      );

      return res.json({
        success: true,
        message: "Cancellation request submitted"
      });
    }

    // VALID STATUS
    if (!["approved", "rejected", "cancelled", "cancellation_rejected"].includes(status))
      return res.status(400).json({ message: "Invalid status" });

    const find = await pool.query(
      `SELECT * FROM leave_requests WHERE leave_id=$1`,
      [leaveId]
    );

    if (!find.rows.length)
      return res.status(404).json({ message: "Leave not found" });

    const leave = find.rows[0];
    const staffId = leave.staff_id;
    const leaveType = String(leave.leave_type || "").trim().toUpperCase();
    const days = Number(leave.total_days);
    const leaveDate = new Date(leave.date_from);

    /* ============================================================
        CANCELLATION APPROVED — RETURN LEAVE FIRST!
    ============================================================ */
    if (status === "cancelled") {

      if (leaveType === "AL" || leaveType === "EL") {

        const { deduct_cf, deduct_al } = leave;

        await pool.query(
          `UPDATE profiles
           SET carry_forward_balance = carry_forward_balance + $1,
               leave_entitlement_annual = leave_entitlement_annual + $2
           WHERE staff_id=$3`,
          [deduct_cf, deduct_al, staffId]
        );
      }
      
      // UPDATE REMAINING
      await updateRemainingLeave(staffId);

      // SET STATUS CANCELLED
      const updated = await pool.query(
        `UPDATE leave_requests SET status='cancelled' WHERE leave_id=$1 RETURNING *`,
        [leaveId]
      );
      
      // ✅ CORRECT: Log AFTER status is updated
      await logAdminAction(
        req, 
        'Approved Cancellation Request', 
        `Approved cancellation request #${leaveId} for ${leave.staff_name}. Leave cancelled and balance restored.`
      );
      
      return res.json(updated.rows[0]);
    }
 /* ============================================================
        CANCELLATION REJECTED — KEEP STATUS AS APPROVED
    ============================================================ */
    if (status === "cancellation_rejected") {
      
      // Keep the leave as approved
      const updated = await pool.query(
        `UPDATE leave_requests 
         SET status='approved', request_type='new'
         WHERE leave_id=$1 
         RETURNING *`,
        [leaveId]
      );
      
      await logAdminAction(
        req, 
        'Rejected Cancellation Request', 
        `Rejected cancellation request #${leaveId} for ${leave.staff_name}. Leave remains approved.`
      );
      
      return res.json(updated.rows[0]);
    }
    /* ============================================================
        APPROVE (AL / EL) — DEDUCT LEAVE
    ============================================================ */
    if (status === "approved" && (leaveType === "AL" || leaveType === "EL")) {

      const p = await pool.query(
        `SELECT leave_entitlement_annual,
                carry_forward_balance,
                carry_forward_expiry
         FROM profiles
         WHERE staff_id = $1`,
        [staffId]
      );

      let AL = Number(p.rows[0].leave_entitlement_annual);
      let CF = Number(p.rows[0].carry_forward_balance);
      let expiry = p.rows[0].carry_forward_expiry
        ? new Date(p.rows[0].carry_forward_expiry)
        : null;

      console.log('🔍 BEFORE APPROVAL:', { AL, CF, expiry, days, leaveDate });

      // 🔥 FIX: Check if CF has already expired at TODAY'S date
      const today = new Date();
      if (expiry && today > expiry) {
        CF = 0;
        console.log('⚠️ CF already expired, setting CF to 0');
      }

      let deductCF = 0;
      let deductAL = 0;

      // Only use CF if it's still valid AND leave starts before expiry
      if (CF > 0 && expiry && leaveDate <= expiry) {
        // 🔥 FIX: Check if leave spans across expiry date
        const leaveEnd = new Date(leave.date_until);
        
        if (leaveEnd > expiry) {
          // Leave crosses expiry - split calculation
          const msDay = 1000 * 60 * 60 * 24;
          const daysBeforeExpiry = Math.floor((expiry - leaveDate) / msDay) + 1;
          const daysAfterExpiry = days - daysBeforeExpiry;
          
          console.log(`📅 Leave crosses expiry: ${daysBeforeExpiry} days before, ${daysAfterExpiry} days after`);
          
          // Use CF for days before expiry only
          if (CF >= daysBeforeExpiry) {
            deductCF = daysBeforeExpiry;
            deductAL = daysAfterExpiry;
          } else {
            deductCF = CF;
            deductAL = days - CF;
          }
        } else {
          // Entire leave is before expiry - use CF first as usual
          if (CF >= days) {
            deductCF = days;
          } else {
            deductCF = CF;
            deductAL = days - CF;
          }
        }
      } else {
        // CF expired or leave starts after expiry - use AL only
        deductAL = days;
      }

      // Validate sufficient balance
      if (deductAL > AL) {
        return res.status(400).json({
          message: "Insufficient Annual Leave balance.",
          required: deductAL,
          available: AL
        });
      }

      console.log('💰 Calculated Deduction:', { deductCF, deductAL, totalDays: days });
      console.log('📊 Expected New Balance:', { newCF: CF - deductCF, newAL: AL - deductAL });

      // Update profile
      await pool.query(
        `UPDATE profiles
         SET carry_forward_balance = carry_forward_balance - $1,
             leave_entitlement_annual = leave_entitlement_annual - $2
         WHERE staff_id = $3`,
        [deductCF, deductAL, staffId]
      );

      console.log('✅ Profile updated with:', { deductCF, deductAL, staffId });

      // 🔥 IMPORTANT: Save deductions for cancellation restoration
      await pool.query(
        `UPDATE leave_requests
         SET deduct_cf=$1, deduct_al=$2
         WHERE leave_id=$3`,
        [deductCF, deductAL, leaveId]
      );

      console.log('✅ Leave request updated with deductions');

      await updateRemainingLeave(staffId);
      
      console.log('✅ Remaining leave updated');
    }

    /* ============================================================
        APPROVE (UNPAID) — NO DEDUCTION
    ============================================================ */
    // Unpaid leave requires no balance deduction

    /* ============================================================
        OTHER TYPES (MC, HOSP, SPECIAL)
    ============================================================ */
    if (status === "approved" && leaveType === "MC") {

      const m = await pool.query(
        `SELECT leave_entitlement_medical FROM profiles WHERE staff_id=$1`,
        [staffId]
      );

      if (m.rows[0].leave_entitlement_medical < days)
        return res.status(400).json({ message: "Insufficient MC" });

      await pool.query(
        `UPDATE profiles
         SET leave_entitlement_medical = leave_entitlement_medical - $1
         WHERE staff_id=$2`,
        [days, staffId]
      );
    }

    if (status === "approved" && leaveType === "HOSP") {

      const h = await pool.query(
        `SELECT balance FROM leave_entitlements
         WHERE staff_id=$1 AND leave_type='HOSP'`,
        [staffId]
      );

      if (!h.rows.length || h.rows[0].balance < days)
        return res.status(400).json({ message: "Insufficient HOSP" });

      await pool.query(
        `UPDATE leave_entitlements
         SET balance = balance - $1
         WHERE staff_id=$2 AND leave_type='HOSP'`,
        [days, staffId]
      );
    }

    // For special leaves (not UNPAID)
    if (status === "approved" && 
        !["AL", "EL", "MC", "HOSP", "UNPAID"].includes(leaveType)) {
      
      const s = await pool.query(
        `SELECT balance FROM leave_entitlements
         WHERE staff_id=$1 AND leave_type=$2`,
        [staffId, leaveType]
      );

      if (!s.rows.length || s.rows[0].balance < days)
        return res.status(400).json({ message: `Insufficient ${leaveType}` });

      await pool.query(
        `UPDATE leave_entitlements
         SET balance = balance - $1
         WHERE staff_id=$2 AND leave_type=$3`,
        [days, staffId, leaveType]
      );
    }

    // FINAL: UPDATE STATUS
    console.log('📝 About to update status to:', status);
    const updated = await pool.query(
      `UPDATE leave_requests
       SET status=$1
       WHERE leave_id=$2
       RETURNING *`,
      [status, leaveId]
    );
    console.log('✅ Status updated successfully');
    if (status === 'approved') {
          await logAdminAction(
            req, 
            'Approved Leave Request', 
            `Approved leave request #${leaveId} for ${leave.staff_name}`
          );
        
        } else if (status === 'rejected') {
          await logAdminAction(
            req, 
            'Rejected Leave Request', 
            `Rejected leave request #${leaveId} for ${leave.staff_name}`
          );
        }

        res.json(updated.rows[0]);

  } catch (err) {
    console.error("PATCH /:id error:", err);
    return res.status(500).json({ message: "Failed to update leave request" });
  }
  
});


/* ============================================================
    DELETE ALL EMPLOYEE LEAVES
============================================================ */
router.delete("/by-staff/:staffId", async (req, res) => {
  try {
    await pool.query(`DELETE FROM leave_requests WHERE staff_id=$1`, [
      req.params.staffId
    ]);

    return res.json({ success: true });
  } catch (err) {
    console.error("DELETE by-staff error:", err);
    return res.status(500).json({ message: "Failed" });
  }
});

/* ============================================================
    DELETE ONE LEAVE REQUEST
============================================================ */
router.delete("/:id", async (req, res) => {
  try {
    const find = await pool.query(
      `SELECT * FROM leave_requests WHERE leave_id=$1`,
      [req.params.id]
    );

    if (!find.rows.length)
      return res.status(404).json({ message: "Not found" });

    const leave = find.rows[0];
    const staffId = leave.staff_id;
    const leaveType = String(leave.leave_type || "").trim().toUpperCase();
    const days = Number(leave.total_days);

    // 🔥 Restore balance if leave was approved (NOT for UNPAID)
    if (leave.status === "approved" && leaveType !== "UNPAID") {
      if (leaveType === "AL" || leaveType === "EL") {
        const { deduct_cf, deduct_al } = leave;
        
        await pool.query(
          `UPDATE profiles
           SET carry_forward_balance = carry_forward_balance + $1,
               leave_entitlement_annual = leave_entitlement_annual + $2
           WHERE staff_id=$3`,
          [deduct_cf || 0, deduct_al || 0, staffId]
        );
      } else if (leaveType === "MC") {
        await pool.query(
          `UPDATE profiles
           SET leave_entitlement_medical = leave_entitlement_medical + $1
           WHERE staff_id=$2`,
          [days, staffId]
        );
      } else if (leaveType === "HOSP") {
        await pool.query(
          `UPDATE leave_entitlements
           SET balance = balance + $1
           WHERE staff_id=$2 AND leave_type='HOSP'`,
          [days, staffId]
        );
      } else {
        // Other special leaves
        await pool.query(
          `UPDATE leave_entitlements
           SET balance = balance + $1
           WHERE staff_id=$2 AND leave_type=$3`,
          [days, staffId, leaveType]
        );
      }
    }

    // Delete the record
    await pool.query(`DELETE FROM leave_requests WHERE leave_id=$1`, [req.params.id]);

    // Update remaining leave (only for AL/EL)
    if (leaveType === "AL" || leaveType === "EL") {
      await updateRemainingLeave(staffId);
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("DELETE leave error:", err);
    return res.status(500).json({ message: "Failed" });
  }
});

/* ============================================================
    HISTORY
============================================================ */
router.get("/history/all", async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorised" });

    let sql = `
      SELECT lr.leave_id, lr.staff_id, lr.staff_name, lr.department,
             lr.leave_type, lr.status, lr.total_days,
             lr.date_from, lr.date_until, lr.created_at,
             p.photourl, p.position
      FROM leave_requests lr
      LEFT JOIN profiles p ON p.staff_id = lr.staff_id
    `;

    let params = [];

    if (user.role === "Manager") {
      sql += ` WHERE lr.department=$1 `;
      params.push(user.department);
    }

    sql += ` ORDER BY lr.date_from DESC`;

    const result = await pool.query(sql, params);

    return res.json(result.rows);
  } catch (err) {
    console.error("GET history error:", err);
    return res.status(500).json({ message: "Failed load history" });
  }
});

/* ============================================================
    GET MY LEAVES
============================================================ */
router.get("/me", async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorised" });

    const result = await pool.query(
      `SELECT * FROM leave_requests
       WHERE staff_id=$1
       ORDER BY date_from ASC`,
      [user.staff_id]
    );

    return res.json(result.rows);
  } catch (err) {
    console.error("GET /me error:", err);
    return res.status(500).json({ message: "Failed load" });
  }
});

// TEMPORARY - Test cron (runs every minute)
// cron.schedule('* * * * *', async () => {
//   console.log('🧪 TEST CRON TRIGGERED');
//   const success = await resetAnnualLeaveForNewYear();
//   if (success) {
//     console.log('✅ Test reset completed!');
//   } else {
//     console.error('❌ Test reset failed!');
//   }
// });
// console.log('⏰ TEST: Cron running every minute');


// Calculate time 2 minutes from now
// const now = new Date();
// const testTime = new Date(now.getTime() + 2 * 60000);
// const minute = testTime.getMinutes();
// const hour = testTime.getHours();

// console.log(`⏰ TEST: Cron will trigger at ${hour}:${minute} (in ~2 minutes)`);

// // Test cron - triggers once at specific time
// cron.schedule(`${minute} ${hour} * * *`, async () => {
//   console.log('🎉 TEST TRIGGER - Simulating Jan 1 behavior');
//   const success = await resetAnnualLeaveForNewYear();
//   if (success) {
//     console.log('✅ Test reset completed!');
//   } else {
//     console.error('❌ Test reset failed!');
//   }
// });


/* ============================================================
    AUTOMATIC YEARLY RESET - RUNS JANUARY 1 AT 00:00
============================================================ */
cron.schedule('0 0 1 1 *', async () => {
  console.log('🎉 AUTO YEARLY RESET TRIGGERED - January 1, 00:00');
  const success = await resetAnnualLeaveForNewYear();
  if (success) {
    console.log('✅ Yearly leave reset completed successfully!');
  } else {
    console.error('❌ Yearly leave reset failed!');
  }
});

console.log('⏰ Cron job scheduled: Yearly reset on January 1 at midnight');
// ============================================================
// AUTO MARK APPROVED LEAVES AS INVALID (SAFETY NET)
// ============================================================
cron.schedule('*/1 * * * *', async () => {
  console.log('🧹 Checking approved leaves with zero days...');
  await markInvalidApprovedLeaves();
});

export default router;

