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
import { safeSendEmail } from "../utils/safeEmail.js";

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
const uploadDir = "uploads/leave_attachments";

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName =
      Date.now() + "-" + Math.round(Math.random() * 1e9) + ext;

    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

/* ============================================================
    HELPER FUNCTIONS FOR LEAVE CALCULATION
============================================================ */

function calculateYearsOfService(employmentDate) {
  if (!employmentDate) return 0;
  
  const today = new Date();
  const empDate = new Date(employmentDate);
  
  let years = today.getFullYear() - empDate.getFullYear();
  const monthDiff = today.getMonth() - empDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < empDate.getDate())) {
    years--;
  }
  
  return years;
}

function getBaseAnnualLeave(yearsOfService) {
  return yearsOfService >= 5 ? 16 : 14;
}

function getBaseMedicalLeave(yearsOfService) {
  if (yearsOfService >= 5) return 22;
  if (yearsOfService >= 2) return 18;
  return 14;
}

/* ============================================================
    YEARLY RESET
============================================================ */
async function resetAnnualLeaveForNewYear() {
  try {
    console.log('🎉 Starting Annual Leave Reset for New Year...');
    
    const staffList = await pool.query(`
      SELECT staff_id, 
             employment_date,
             leave_entitlement_annual, 
             leave_entitlement_annual_original,
             leave_entitlement_medical_original
      FROM profiles
      WHERE termination_date IS NULL
    `);

    const currentYear = new Date().getFullYear();
    const expiryDate = `${currentYear}-04-30`;

    let successCount = 0;
    let errorCount = 0;

    for (const s of staffList.rows) {
      try {
        // ========================================
        // RECALCULATE LEAVE BASED ON YEARS OF SERVICE
        // ========================================
        const yearsOfService = calculateYearsOfService(s.employment_date);
        const newAnnualLeave = getBaseAnnualLeave(yearsOfService);
        const newMedicalLeave = getBaseMedicalLeave(yearsOfService);

        // ========================================
        // CALCULATE CARRY FORWARD (MAX 7 DAYS)
        // ========================================
        const currentAL = Number(s.leave_entitlement_annual || 0);
        const carryForward = Math.min(currentAL, 7);

        console.log(`📊 Reset for ${s.staff_id}:`, {
          yearsOfService,
          oldAL: s.leave_entitlement_annual_original,
          newAL: newAnnualLeave,
          oldMC: s.leave_entitlement_medical_original,
          newMC: newMedicalLeave,
          carryForward
        });

        // ========================================
        // UPDATE PROFILE WITH NEW ENTITLEMENTS
        // ========================================
        await pool.query(
          `UPDATE profiles
            SET 
              -- Carry forward from previous year
              carry_forward_balance = $1::numeric,
              carry_forward_original = $1::numeric,
              carry_forward_expiry = $2,
              
              -- New entitlements (recalculated based on years of service)
              leave_entitlement_annual_original = $3::numeric,
              leave_entitlement_medical_original = $4::numeric,
              
              -- Reset current balances to new full entitlements
              leave_entitlement_annual = $3::numeric,
              leave_entitlement_medical = $4::numeric,
              
              -- Total remaining (new AL + carry forward)
              remaining_leave = $3::numeric + $1::numeric,
              
              -- Track when reset happened
              updated_at = NOW()
            WHERE staff_id = $5`,
          [carryForward, expiryDate, newAnnualLeave, newMedicalLeave, s.staff_id]
        );

        successCount++;
        console.log(`✅ Reset complete for ${s.staff_id}: AL=${newAnnualLeave}, MC=${newMedicalLeave}, CF=${carryForward}`);

      } catch (empErr) {
        errorCount++;
        console.error(`❌ Failed to reset ${s.staff_id}:`, empErr);
      }
    }

    console.log(`
    ╔════════════════════════════════════════╗
    ║     YEARLY LEAVE RESET COMPLETE        ║
    ╠════════════════════════════════════════╣
    ║  ✅ Success: ${successCount.toString().padStart(3)} employees         ║
    ║  ❌ Errors:  ${errorCount.toString().padStart(3)} employees          ║
    ║  📅 CF Expiry: ${expiryDate}              ║
    ╚════════════════════════════════════════╝
    `);

    return errorCount === 0;

  } catch (err) {
    console.error("❌ CRITICAL ERROR in resetAnnualLeaveForNewYear:", err);
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
// ZERO OUT EXPIRED CARRY FORWARD (Runs May 1 at 00:00)
// ============================================================
async function zeroExpiredCarryForward() {
  try {
    const result = await pool.query(`
      UPDATE profiles
      SET carry_forward_balance = 0,
          carry_forward_original = 0
      WHERE carry_forward_expiry IS NOT NULL
        AND carry_forward_expiry < CURRENT_DATE
        AND (carry_forward_balance > 0 OR carry_forward_original > 0)
      RETURNING staff_id
    `);

    if (result.rows.length) {
      console.log(`🧹 Zeroed out carry forward for ${result.rows.length} employee(s):`,
        result.rows.map(r => r.staff_id).join(', '));
    }

    return true;
  } catch (err) {
    console.error("❌ Failed to zero expired carry forward:", err);
    return false;
  }
}

// ============================================================
// MARK APPROVED LEAVES AS INVALID IF TOTAL_DAYS = 0
// ============================================================
async function markInvalidApprovedLeaves() {
  try {
    const result = await pool.query(`
      UPDATE leave_requests
      SET status = 'invalid'
      WHERE status IN ('approved', 'rejected', 'pending', 'cancelled', 'cancellation_pending')
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

    const userRole = (user.role || "").trim().toLowerCase();
    const userDept = (user.department || "").trim().toLowerCase();

    const staffId = user.staff_id;

    // ✅ BACKDATE VALIDATION — AL max 7 days, MC max 7 days
    const msPerDay = 24 * 60 * 60 * 1000;
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const backdateDays = Math.floor(
      (new Date(todayStr) - new Date(dateFrom)) / msPerDay
    );

    if (type === "AL" && backdateDays > 7) {
      return res
        .status(400)
        .json({ message: "Annual Leave can only be backdated up to 7 days." });
    }
    if (type === "MC" && backdateDays > 7) {
      return res
        .status(400)
        .json({ message: "Medical Leave can only be backdated up to 7 days." });
    }

    // let serverDays;
    // if (duration === 'Half') {
    //   serverDays = 0.5;
    // } else {
    //   serverDays = await calculateWorkingDays(dateFrom, dateUntil);
    // }


    let serverDays;
    if (duration === 'Half') {
      serverDays = 0.5;
    } else {
      // ✅ Special leaves include weekends (calendar days)
      if (['MAT', 'PAT', 'HOSP', 'COMP_A', 'COMP_B'].includes(type)) {
        const start = new Date(dateFrom);
        const end = new Date(dateUntil);
        serverDays = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
      } else {
        // AL, EL, MC, MAR, UNPAID use working days
        serverDays = await calculateWorkingDays(dateFrom, dateUntil);
      }
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
    // ===== UNPAID LEAVE =====
    // User can only apply UNPAID when all available AL + valid CF
    // are not enough for the requested leave.
    if (type === "UNPAID") {
      const p = await pool.query(
        `SELECT
            leave_entitlement_annual,
            carry_forward_balance,
            carry_forward_expiry
        FROM profiles
        WHERE staff_id = $1`,
        [staffId]
      );

      if (!p.rows.length) {
        return res.status(404).json({
          message: "Employee profile not found."
        });
      }

      const row = p.rows[0];

      const AL = Number(row.leave_entitlement_annual || 0);
      let CF = Number(row.carry_forward_balance || 0);

      const expiry = row.carry_forward_expiry
        ? new Date(row.carry_forward_expiry)
        : null;

      // Use the requested leave date, not today's date
      const requestedStartDate = new Date(dateFrom);

      if (expiry && requestedStartDate > expiry) {
        CF = 0;
      }

      const availableAnnualLeave = AL + CF;

      // Block UNPAID when AL/CF can fully cover the request
      if (availableAnnualLeave >= serverDays) {
        return res.status(400).json({
          message:
            `You still have ${availableAnnualLeave} day(s) of Annual Leave available. Please apply Annual Leave instead.`,
          annualBalance: AL,
          carryForwardBalance: CF,
          requested: serverDays
        });
      }

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
           AND status IN ('pending','cancellation_pending')`,
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
           AND status IN ('pending','cancellation_pending')`,
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
           AND status IN ('pending','cancellation_pending')`,
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
           AND status IN ('pending','cancellation_pending')`,
        [staffId, type]
      );
      used = Number(u.rows[0].used);
    }

    // FINAL CHECK
    if (serverDays > entitlement) {
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
    safeSendEmail(
      sendLeaveSubmitted,
      user.email,
      user.full_name,
      leave
    );

    // 🔔 APPROVER NOTIFICATIONS

    // =========================
    // 1️⃣ ADMIN → ALWAYS NOTIFY
    // =========================
    const adminRes = await pool.query(
      `SELECT email FROM profiles WHERE LOWER(role) = 'admin'`
    );

    for (const row of adminRes.rows) {
    safeSendEmail(
      sendPendingApproval,
      row.email,
      user.full_name,
      leave
    );
    }

    // =========================
    // 2️⃣ ROLE: DIRECTOR
    // =========================
    if (userRole === "director") {
      // ❌ Director tak notify sesiapa
      // ✅ Admin already notified
    }

    // =========================
    // 3️⃣ ROLE: MANAGER
    // =========================
    else if (userRole === "manager") {

      // 🔥 Manager department Director
      if (userDept === "director") {

        // Notify manager department Director (exclude diri sendiri)
        const directorMgrRes = await pool.query(
          `SELECT email FROM profiles
          WHERE LOWER(role) = 'manager'
            AND LOWER(department) = 'director'`
        );

        for (const row of directorMgrRes.rows) {
          if (row.email !== user.email) {
            safeSendEmail(
            sendPendingApproval,
            row.email,
            user.full_name,
            leave
          );
          }
        }

      } 
      // 🔥 Manager department lain
      else {

        // Notify Manager department Director
        const directorMgrRes = await pool.query(
          `SELECT email FROM profiles
          WHERE LOWER(role) = 'manager'
            AND LOWER(department) = 'director'`
        );

        for (const row of directorMgrRes.rows) {
          safeSendEmail(
          sendPendingApproval,
          row.email,
          user.full_name,
          leave
        );
        }

        // ❌ Tak notify Director role
        // ❌ Tak notify manager lain
      }
    }

    // =========================
    // 4️⃣ ROLE: STAFF
    // =========================
else {
      
      const mgrRes = await pool.query(
        `SELECT email
         FROM profiles
         WHERE LOWER(role) = 'manager'
         AND EXISTS (
             SELECT 1
             FROM unnest(string_to_array(LOWER(department), ',')) mgrDept
             WHERE trim(mgrDept) = $1
         )`,
        [userDept]
      );

      // 🌟 STEP 2: Loop through the rows we found and email BOTH Azira and irfan888!
      for (const row of mgrRes.rows) {
        safeSendEmail(
          sendPendingApproval,
          row.email,
          user.full_name,
          leave
        );
      }
    }

    // This line comes right after the closing block (around line 470)
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
    
    const user = req.user;
    const { status } = req.query;

    if (!user) {
      return res.status(401).json({ message: "Unauthorised" });
    }

    let where = [];
    let params = [];

    // =========================
    // STATUS FILTER (optional)
    // =========================
    if (status) {
      // 🌟 FIX: Add LOWER(TRIM()) here so spaces in your DB status column can't hide rows
      where.push(`LOWER(TRIM(lr.status)) = LOWER(TRIM($${params.length + 1}))`);
      params.push(status);
    }

  // =========================
    // ROLE + DEPARTMENT RULE
    // =========================
if (user.role === 'Manager') {
      
      // 1️⃣ Always push the manager's own staff_id first to establish a safe static index token
      params.push(user.staff_id);
      const myOwnStaffIdToken = `$${params.length}`;

      // 🔥 Manager department Director (Luqman)
      if (user.department === 'Director') {
        params.push('Director');
        const directorDeptToken = `$${params.length}`;

        // Clean up the query logic so it safely checks strings
        where.push(`
          (
            lr.staff_id = ${myOwnStaffIdToken}
            OR LOWER(TRIM(lr.department)) = LOWER(TRIM(${directorDeptToken}))
            OR LOWER(TRIM(lr.requester_role)) = 'manager'
          )
        `);

      } else {
        // 🔥 Normal Manager (Irfan)
        params.push(user.department);
        const normalMgrDeptToken = `$${params.length}`;

        where.push(`
          (
            lr.staff_id = ${myOwnStaffIdToken}
            OR EXISTS (
              SELECT 1
              FROM unnest(string_to_array(LOWER(${normalMgrDeptToken}), ',')) mgrDept
              WHERE trim(mgrDept) = LOWER(TRIM(lr.department))
            )
          )
        `);
      }
    }
    // Admin → no filter (see all)

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
        p.carry_forward_balance,
        p.carry_forward_expiry,
        p.notes
      FROM leave_requests lr
      LEFT JOIN profiles p ON p.staff_id = lr.staff_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY lr.created_at DESC
    `;

    const result = await pool.query(sql, params);
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

    // let serverDays;
    // if (leave_type === "MAR") { 
    // // sebelum ni type === MAR
    //   serverDays = await calculateWorkingDays(dateFrom, dateUntil);
      
    //   if (serverDays <= 0)
    //     return res.status(400).json({ message: "Invalid date range or no working days" });
    // }
    // // For other leave types: respect duration
    // else if (duration === 'Half') {
    //   serverDays = 0.5;
    // } else {
    //   serverDays = await calculateWorkingDays(dateFrom, dateUntil);
    // }

    let serverDays;
    if (duration === 'Half') {
      serverDays = 0.5;
    } else {
      // ✅ Special leaves include weekends (calendar days)
      if (['MAT', 'PAT', 'HOSP', 'COMP_A', 'COMP_B'].includes(leave_type)) {
        const start = new Date(date_from);
        const end = new Date(date_until);
        serverDays = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
      } else {
        // AL, EL, MC, MAR, UNPAID use working days
        serverDays = await calculateWorkingDays(date_from, date_until);
      }
    }
    
    if (serverDays <= 0)
      return res.status(400).json({ message: "Invalid date range or no working days" });

    // ✅ BACKDATE VALIDATION — AL max 7 days, MC max 7 days
    const msPerDay = 24 * 60 * 60 * 1000;
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const backdateDays = Math.floor(
      (new Date(todayStr) - new Date(date_from)) / msPerDay
    );

    if (leave_type === "AL" && backdateDays > 7) {
      return res
        .status(400)
        .json({ message: "Annual Leave can only be backdated up to 7 days." });
    }
    if (leave_type === "MC" && backdateDays > 7) {
      return res
        .status(400)
        .json({ message: "Medical Leave can only be backdated up to 7 days." });
    }

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

    // ===== UNPAID LEAVE =====
    if (leave_type === "UNPAID") {
      const p = await pool.query(
        `SELECT
            leave_entitlement_annual,
            carry_forward_balance,
            carry_forward_expiry
        FROM profiles
        WHERE staff_id = $1`,
        [staffId]
      );

      if (!p.rows.length) {
        return res.status(404).json({
          message: "Employee profile not found."
        });
      }

      const row = p.rows[0];

      const AL = Number(row.leave_entitlement_annual || 0);
      let CF = Number(row.carry_forward_balance || 0);

      const expiry = row.carry_forward_expiry
        ? new Date(row.carry_forward_expiry)
        : null;

      const requestedStartDate = new Date(date_from);

      if (expiry && requestedStartDate > expiry) {
        CF = 0;
      }

      const availableAnnualLeave = AL + CF;

      if (availableAnnualLeave >= serverDays) {
        return res.status(400).json({
          message:
            `You still have ${availableAnnualLeave} day(s) of Annual Leave available. Please apply Annual Leave instead.`,
          annualBalance: AL,
          carryForwardBalance: CF,
          requested: serverDays
        });
      }

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
           AND status IN ('pending','cancellation_pending')
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
           AND status IN ('pending','cancellation_pending')
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
           AND status IN ('pending','cancellation_pending')
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
           AND status IN ('pending','cancellation_pending')
           AND leave_id != $3`,
        [staffId, leave_type, leaveId]
      );

      used = Number(u.rows[0].used);
    }

    if (serverDays > entitlement){
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
  const { cancellation_reason } = req.body;

  if (!cancellation_reason || !cancellation_reason.trim()) {
    return res.status(400).json({
      message: "Cancellation reason is required"
    });
  }

  // ==========================
  // ⏱ CANCELLATION RULE (NEW)
  // ==========================
  const find = await pool.query(
  `SELECT * FROM leave_requests WHERE leave_id = $1`,
  [leaveId]
);

  if (!find.rows.length) {
    return res.status(404).json({ message: "Leave not found" });
  }

  const leave = find.rows[0]; 
  const leaveStart = new Date(find.rows[0].date_from);
  const today = new Date();

  const msInDay = 1000 * 60 * 60 * 24;
  const diffDays = Math.floor((today - leaveStart) / msInDay);

  /*
    RULE:
    - diffDays < 0  → BEFORE leave → allowed
    - diffDays 0–7  → within 7 days after start → allowed
    - diffDays > 7  → NOT allowed
  */
  if (diffDays > 7) {
    return res.status(400).json({
      message:
        "Cancellation is only allowed within 7 days after the leave start date."
    });
  }

  // ==========================
  // ✅ ALLOW CANCELLATION
  // ==========================
  await pool.query(
    `UPDATE leave_requests
     SET 
       request_type = 'cancellation_request',
       status = 'cancellation_pending',
       cancellation_reason = $1
     WHERE leave_id = $2`,
    [cancellation_reason, leaveId]
  );
  // 🔔 NOTIFY ADMIN (CANCELLATION PENDING)
const adminRes = await pool.query(
  `SELECT email FROM profiles WHERE LOWER(role) = 'admin'`
);

for (const row of adminRes.rows) {
    safeSendEmail(
    sendCancellationPending,
    row.email,
    leave.staff_name,
    leave
  );
    }

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

    if (status === "approved" && leave.status === "approved") {
      return res.status(400).json({
        message: "This leave request has already been approved."
      });
    }

    const staffId = leave.staff_id;
    const emailRes = await pool.query(
  `SELECT email FROM profiles WHERE staff_id = $1`,
  [staffId]
);

const staffEmail = emailRes.rows[0]?.email;
    const leaveType = String(leave.leave_type || "").trim().toUpperCase();
    const days = Number(leave.total_days);
    const leaveDate = new Date(leave.date_from);

    /* ============================================================
        CANCELLATION APPROVED — RETURN LEAVE FIRST!
    ============================================================ */
    if (status === "cancelled") {

      if (leaveType === "AL" || leaveType === "EL") {

        const { deduct_cf, deduct_al } = leave;

        const client = await pool.connect();
        try {
          await client.query('BEGIN');

          // Lock the profile row before restoring balances
          await client.query(
            `SELECT 1 FROM profiles WHERE staff_id = $1 FOR UPDATE`,
            [staffId]
          );

          await client.query(
            `UPDATE profiles
             SET carry_forward_balance = carry_forward_balance + $1,
                 leave_entitlement_annual = leave_entitlement_annual + $2
             WHERE staff_id=$3`,
            [deduct_cf, deduct_al, staffId]
          );

          await client.query('COMMIT');
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        } finally {
          client.release();
        }
      }
      
      // UPDATE REMAINING
      await updateRemainingLeave(staffId);

      // SET STATUS CANCELLED
      const updated = await pool.query(
        `UPDATE leave_requests SET status='cancelled' WHERE leave_id=$1 RETURNING *`,
        [leaveId]
      );

      safeSendEmail(
      sendCancellationApproved,
      staffEmail,
      updated.rows[0]
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
          SET 
            status = 'approved',
            request_type = 'new',
            cancellation_reason = NULL
          WHERE leave_id = $1
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

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const p = await client.query(
          `SELECT leave_entitlement_annual,
                  carry_forward_balance,
                  carry_forward_expiry
           FROM profiles
           WHERE staff_id = $1
           FOR UPDATE`,
          [staffId]
        );

        let AL = Number(p.rows[0].leave_entitlement_annual);
        let CF = Number(p.rows[0].carry_forward_balance);
        let expiry = p.rows[0].carry_forward_expiry
          ? new Date(p.rows[0].carry_forward_expiry)
          : null;

        console.log('🔍 BEFORE APPROVAL:', { AL, CF, expiry, days, leaveDate });

        const today = new Date();
        if (expiry && today > expiry) {
          CF = 0;
          console.log('⚠️ CF already expired, setting CF to 0');
        }

        let deductCF = 0;
        let deductAL = 0;

        if (CF > 0 && expiry && leaveDate <= expiry) {
          const leaveEnd = new Date(leave.date_until);
          
          if (leaveEnd > expiry) {
            const msDay = 1000 * 60 * 60 * 24;
            const daysBeforeExpiry = Math.floor((expiry - leaveDate) / msDay) + 1;
            const daysAfterExpiry = days - daysBeforeExpiry;
            
            console.log(`📅 Leave crosses expiry: ${daysBeforeExpiry} days before, ${daysAfterExpiry} days after`);
            
            if (CF >= daysBeforeExpiry) {
              deductCF = daysBeforeExpiry;
              deductAL = daysAfterExpiry;
            } else {
              deductCF = CF;
              deductAL = days - CF;
            }
          } else {
            if (CF >= days) {
              deductCF = days;
            } else {
              deductCF = CF;
              deductAL = days - CF;
            }
          }
        } else {
          deductAL = days;
        }

        if (deductAL > AL) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            message: "Insufficient Annual Leave balance.",
            required: deductAL,
            available: AL
          });
        }

        console.log('💰 Calculated Deduction:', { deductCF, deductAL, totalDays: days });
        console.log('📊 Expected New Balance:', { newCF: CF - deductCF, newAL: AL - deductAL });

        await client.query(
          `UPDATE profiles
           SET carry_forward_balance = carry_forward_balance - $1,
               leave_entitlement_annual = leave_entitlement_annual - $2
           WHERE staff_id = $3`,
          [deductCF, deductAL, staffId]
        );

        console.log('✅ Profile updated with:', { deductCF, deductAL, staffId });

        await client.query(
          `UPDATE leave_requests
           SET deduct_cf=$1, deduct_al=$2
           WHERE leave_id=$3`,
          [deductCF, deductAL, leaveId]
        );

        console.log('✅ Leave request updated with deductions');

        await client.query('COMMIT');
        console.log('✅ Transaction committed');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }

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
        safeSendEmail(
        sendLeaveApproved,
        staffEmail,
        leave
      );

        await logAdminAction(
          req, 
          'Approved Leave Request', 
          `Approved leave request #${leaveId} for ${leave.staff_name}`
        );
      }
      else if (status === 'rejected') {
        safeSendEmail(
        sendLeaveRejected,
        staffEmail,
        leave
      );

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

        const client = await pool.connect();
        try {
          await client.query('BEGIN');

          await client.query(
            `SELECT 1 FROM profiles WHERE staff_id = $1 FOR UPDATE`,
            [staffId]
          );

          await client.query(
            `UPDATE profiles
             SET carry_forward_balance = carry_forward_balance + $1,
                 leave_entitlement_annual = leave_entitlement_annual + $2
             WHERE staff_id=$3`,
            [deduct_cf || 0, deduct_al || 0, staffId]
          );

          await client.query('COMMIT');
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        } finally {
          client.release();
        }
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
    if (!user) {
      return res.status(401).json({ message: "Unauthorised" });
    }

    // 1️⃣ BASE SQL (WAJIB ADA)
    let sql = `
      SELECT
        lr.leave_id, lr.staff_id, lr.staff_name, lr.department,
        lr.requester_role, lr.requester_position,
        lr.leave_type, lr.status, lr.total_days,
        lr.date_from, lr.date_until, lr.created_at,
        lr.reason, lr.cancellation_reason, lr.attachment_path,
        p.photourl, p.position,
        p.leave_entitlement_annual, p.leave_entitlement_medical
      FROM leave_requests lr
      LEFT JOIN profiles p ON p.staff_id = lr.staff_id
    `;

    let where = [];
    let params = [];

    // =========================
    // ADMIN → SEMUA
    // =========================
    if (user.role === "Admin") {
      // no filter
    }

    // =========================
    // DIRECTOR
    // =========================
    else if (user.role === "Director") {
      where.push(`
        (
          lr.requester_role = 'Manager'
          OR lr.department = $${params.length + 1}
        )
      `);
      params.push(user.department);
    }

    // =========================
    // MANAGER
    // =========================
    else if (user.role === "Manager") {
      const viewMode = req.query.viewMode || "restricted";

      const canAllView =
        user.department === "Director" &&
        viewMode === "all";

      if (!canAllView) {
        if (user.department === "Director") {
          where.push(`
            (
              lr.requester_role = 'Manager'
              OR lr.department = $${params.length + 1}
            )
          `);
          params.push("Director");
        } else {
            params.push(user.department);

            where.push(`
              EXISTS (
                SELECT 1
                FROM unnest(string_to_array($${params.length}, ',')) mgrDept
                WHERE trim(mgrDept) = lr.department
              )
            `);
        }
      }
      // canAllView === true → no filter
    }

    // 2️⃣ APPLY WHERE (INI YANG KAU TAK BUAT TADI)
    if (where.length) {
      sql += ` WHERE ${where.join(" AND ")}`;
    }

    // 3️⃣ ORDER BY
    sql += ` ORDER BY lr.date_from DESC`;

    // 4️⃣ EXECUTE
    console.log("SQL:", sql);
    console.log("PARAMS:", params);
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

/* ============================================================
    AUTOMATIC YEARLY RESET - RUNS JANUARY 1 AT 00:00
    - Carries forward unused AL (max 7 days) with April 30 expiry
    - Resets annual & medical entitlements based on years of service
    - Resets remaining_leave = new AL + carry forward
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
console.log('⏰ Cron scheduled: Yearly reset on January 1 at midnight');

/* ============================================================
    AUTO MARK APPROVED LEAVES AS INVALID (SAFETY NET)
============================================================ */
cron.schedule('*/1 * * * *', async () => {
  // console.log('🧹 Checking approved leaves with zero days...');
  await markInvalidApprovedLeaves();
});

/* ============================================================
    EXPIRED CARRY FORWARD CLEANUP — May 1 at 00:00
    Zeros out carry_forward_balance for all employees whose
    carry_forward_expiry has passed (April 30 of this year).
============================================================ */
cron.schedule('0 0 1 5 *', async () => {
  console.log('🧹 AUTO: Zeroing out expired carry forward balances...');
  await zeroExpiredCarryForward();
});
console.log('⏰ Cron scheduled: Carry forward expiry cleanup on May 1 at midnight');

export default router;

