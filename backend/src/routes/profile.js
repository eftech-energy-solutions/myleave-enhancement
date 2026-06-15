import express from 'express';
import pool from '../db.js';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { logAdminAction } from '../middleware/adminLogger.js';

const router = express.Router();

/* ============================================================
   HELPER FUNCTIONS
============================================================ */

/**
 * Calculate years of service from employment date
 */
function calculateYearsOfService(employmentDate) {
  if (!employmentDate) return 0;
  
  const today = new Date();
  const empDate = new Date(employmentDate);
  
  let years = today.getFullYear() - empDate.getFullYear();
  const monthDiff = today.getMonth() - empDate.getMonth();
  
  // Adjust if birthday hasn't occurred this year
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < empDate.getDate())) {
    years--;
  }
  
  return years;
}

/**
 * Get base annual leave entitlement based on years of service
 */
function getBaseAnnualLeave(yearsOfService) {
  return yearsOfService >= 5 ? 16 : 14;
}

/**
 * Get medical leave entitlement based on years of service
 */
function getBaseMedicalLeave(yearsOfService) {
  if (yearsOfService >= 5) return 22;
  if (yearsOfService >= 2) return 18;
  return 14;
}

/**
 * Calculate prorated leave for mid-year joiners
 * - Joins in January = full entitlement
 * - Joins in December = 1/12th
 * - Rounds up (e.g., 7.5 → 8 days)
 * Works for both Annual Leave AND Medical Leave
 */
function calculateProratedLeave(employmentDate, baseEntitlement) {
  if (!employmentDate) return baseEntitlement;
  
  const empDate = new Date(employmentDate);
  const currentYear = new Date().getFullYear();
  const empYear = empDate.getFullYear();
  
  // If joined before this year, give full entitlement
  if (empYear < currentYear) {
    return baseEntitlement;
  }
  
  // If joined this year, prorate based on remaining months
  const empMonth = empDate.getMonth(); // 0 = January, 11 = December
  const remainingMonths = 12 - empMonth;
  
  const prorated = (baseEntitlement / 12) * remainingMonths;
  
  // Round up (7.5 → 8, 7.1 → 8)
  return Math.ceil(prorated);
}

/* ============================================================
   1) ADD NEW EMPLOYEE (WITH AUTO CALCULATION)
============================================================ */
router.post('/', async (req, res) => {
  const {
    empId,
    name,
    email,
    role,
    position,
    department,
    employmentDate,
    confirmationDate,
    terminationDate,
    gender,
    medicalLeave, // Only MC is manual
    notes,
    photoUrl
  } = req.body;

  try {
    const randomPassword = crypto.randomBytes(6).toString('hex');

    // =============================
    // AUTO CALCULATE LEAVE ENTITLEMENTS (BOTH PRORATED)
    // =============================
    const yearsOfService = calculateYearsOfService(employmentDate);
    const baseAnnualLeave = getBaseAnnualLeave(yearsOfService);
    const baseMedicalLeave = getBaseMedicalLeave(yearsOfService);
    const proratedAnnualLeave = calculateProratedLeave(employmentDate, baseAnnualLeave);
    const proratedMedicalLeave = calculateProratedLeave(employmentDate, baseMedicalLeave);

    console.log('📊 New Employee Leave Calculation:', {
      empId,
      employmentDate,
      yearsOfService,
      baseAnnualLeave,
      baseMedicalLeave,
      proratedAnnualLeave,
      proratedMedicalLeave
    });

    // =============================
    // INSERT EMPLOYEE INTO PROFILES
    // =============================
    await pool.query(
      `INSERT INTO profiles (
        full_name,
        staff_id,
        email,
        password,
        role,
        department,
        employment_date,
        confirmation_date,
        termination_date,
        gender,
        notes,

        -- Original fields (never change during year)
        leave_entitlement_annual_original,
        leave_entitlement_medical_original,
        
        -- Current fields (will be deducted)
        leave_entitlement_annual,
        leave_entitlement_medical,
        
        carry_forward_original,
        carry_forward_balance,
        carry_forward_expiry,

        photourl,
        position
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
        $12,$13,$14,$15,$16,$17,$18,$19,$20
      )`,
      [
        name,                     // $1
        empId,                    // $2
        email,                    // $3
        randomPassword,           // $4
        role,                     // $5
        department,               // $6
        employmentDate || null,   // $7
        confirmationDate || null, // $8
        terminationDate || null,  // $9
        gender,                   // $10
        notes,                    // $11

        proratedAnnualLeave,      // $12 (original - prorated for this year)
        proratedMedicalLeave,     // $13 (original - prorated for this year)
        
        proratedAnnualLeave,      // $14 (current - same as original)
        proratedMedicalLeave,     // $15 (current - same as original)
        
        0,                        // $16 carry_forward_original
        0,                        // $17 carry_forward_balance
        null,                     // $18 carry_forward_expiry

        photoUrl,                 // $19
        position                  // $20
      ]
    );

    await pool.query(
      `UPDATE profiles
        SET remaining_leave = leave_entitlement_annual_original
      WHERE staff_id = $1`,
      [empId]
    );

    // =============================
    // INSERT FIXED LEAVE TYPES
    // =============================
    await pool.query(`
      INSERT INTO leave_entitlements (staff_id, leave_type, entitlement, balance, year)
      VALUES 
      ($1, 'HOSP', 60, 60, $2),
      ($1, 'MAT', 98, 98, $2),
      ($1, 'PAT', 7, 7, $2),
      ($1, 'COMP_A', 3, 3, $2),
      ($1, 'COMP_B', 1, 1, $2),
      ($1, 'MAR', 3, 3, $2)
    `, [empId, new Date().getFullYear()]);

    // EMAIL SETUP
    const transporter = nodemailer.createTransport({
    host: "mail.eftech.com.my",
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  const loginUrl = "http://edsdata.com.my:3000/login";

  const EMAIL_FOOTER = `
    <hr style="margin-top:30px; border:none; border-top:1px solid #eee;" />

    <div style="text-align:center; margin-top:20px; opacity:0.9;">
      <img 
        src="http://edsdata.com.my:3000/frontend/build/images/eftech.logo.png"
        alt="Eftech Energy Solutions"
        style="width:140px; margin-bottom:8px; display:block; margin-left:auto; margin-right:auto;"
      />

      <img 
        src="http://edsdata.com.my:3000/frontend/build/images/myleave.logo.png"
        alt="MyLeave System"
        style="width:110px; display:block; margin-left:auto; margin-right:auto;"
      />

      <p style="font-size:11px; color:#666; margin-top:10px;">
        This email was automatically generated by <b>MyLeave System</b>.<br/>
        Please do not reply to this email.
      </p>
    </div>
  `;

  // EMAIL TO EMPLOYEE
  await transporter.sendMail({
    from: '"Eftech HR" <no-reply@eftech.com.my>',
    to: email,
    subject: "Your MyLeave Account",
    html: `
      <p>Hi ${name},</p>

      <p>Your <b>MyLeave</b> account has been created.</p>

      <p><b>Login Credentials:</b></p>
      <p>
        <b>Email:</b> ${email}<br/>
        <b>Temporary Password:</b> ${randomPassword}
      </p>

      <p><b>Your Leave Entitlements:</b></p>
      <ul>
        <li>Annual Leave: <b>${proratedAnnualLeave} days</b></li>
        <li>Medical Leave: <b>${proratedMedicalLeave} days</b></li>
      </ul>

      <p style="font-size:13px; color:#555;">
        ${
          yearsOfService >= 5
            ? '(16 AL / 22 MC base – 5+ years service)'
            : yearsOfService >= 2
            ? '(14 AL / 18 MC base – 2–4 years service)'
            : '(14 AL / 14 MC base – less than 2 years service)'
        }
        <br/>
        ${
          (proratedAnnualLeave < baseAnnualLeave || proratedMedicalLeave < baseMedicalLeave)
            ? '(Prorated for joining mid-year)'
            : ''
        }
      </p>

      <p>Please follow the steps below:</p>
      <ol>
        <li>Go to the MyLeave system: 
          <a href="${loginUrl}">${loginUrl}</a>
        </li>
        <li>Log in using the temporary password above</li>
        <li>Change your password immediately after logging in</li>
      </ol>

      <p>
        For security reasons, please do not share your login details with anyone.
      </p>

      <p>Thank you,<br/><b>Eftech HR Team</b></p>

      ${EMAIL_FOOTER}
    `
  });

    // EMAIL TO ADMIN
    await transporter.sendMail({
      from: '"Eftech HR" <no-reply@eftech.com.my>',
      to: "aziraazman0105@gmail.com",
      subject: `New employee added: ${name}`,
      text: `New employee added:


      

Name: ${name}
Email: ${email}
Role: ${role}
Position: ${position}
Password: ${randomPassword}

Leave Entitlement:
- Annual Leave: ${proratedAnnualLeave} days (Years of Service: ${yearsOfService})
- Medical Leave: ${proratedMedicalLeave} days`,
    });

    await logAdminAction(
      req, 
      'Added Employee', 
      `Added new employee: ${name} (${empId}) - AL: ${proratedAnnualLeave} days`
    );

    res.json({ 
      success: true, 
      message: 'Employee added and emails sent.',
      leaveInfo: {
        yearsOfService,
        baseAnnualLeave,
        baseMedicalLeave,
        proratedAnnualLeave,
        proratedMedicalLeave
      }
    });

  } catch (err) {
    console.error('Error adding employee:', err);
    res.status(500).json({ error: 'Database or email error' });
  }
});

/* ============================================================
   2) GET ALL EMPLOYEES (WITH PRORATED CALCULATION)
============================================================ */
router.get("/", async (req, res) => {
  try {
    const token = req.cookies['auth_token'];
    if (!token) return res.status(401).json({ error: "Not authenticated" });

    const me = JSON.parse(token);

    const meQuery = await pool.query(
      `SELECT role, department FROM profiles WHERE staff_id = $1 LIMIT 1`,
      [me.staffId]
    );

    if (!meQuery.rows.length)
      return res.status(404).json({ error: "User not found" });

    const meData = meQuery.rows[0];
    let result;

    const { viewMode } = req.query;
    // =====================
    // ADMIN → SEE ALL
    // =====================
    if (meData.role?.toLowerCase() === "admin") {
      result = await pool.query(`
        SELECT id, staff_id, full_name, role, position, department, email,
              employment_date, confirmation_date, termination_date,
              gender,
              leave_entitlement_annual_original,
              leave_entitlement_medical_original,
              leave_entitlement_annual,
              leave_entitlement_medical,
              carry_forward_original,
              carry_forward_balance,
              carry_forward_expiry,
              photourl,
              notes
        FROM profiles
        ORDER BY id DESC
      `);

// =====================================================================
    // 🌟 DIRECTOR / MANAGER BYPASS
    // =====================================================================
    } else if (meData.role?.toLowerCase() === "manager" && meData.department === 'Director' && viewMode === 'all') {
      // 🔓 LIFT ALL RESTRICTIONS FOR LUQMAN: Return the absolute full registry list!
      result = await pool.query(`
        SELECT id, staff_id, full_name, role, position, department, email,
               employment_date, confirmation_date, termination_date,
               gender,
               leave_entitlement_annual_original,
               leave_entitlement_medical_original,
               leave_entitlement_annual,
               leave_entitlement_medical,
               carry_forward_original,
               carry_forward_balance,
               carry_forward_expiry,
               photourl,
               notes
        FROM profiles
        ORDER BY id DESC
      `);


    // =====================
    // DIRECTOR → LIMITED
    // =====================
    } else if (meData.role?.toLowerCase() === "director") {
      result = await pool.query(`
        SELECT id, staff_id, full_name, role, position, department, email,
              employment_date, confirmation_date, termination_date,
              gender,
              leave_entitlement_annual_original,
              leave_entitlement_medical_original,
              leave_entitlement_annual,
              leave_entitlement_medical,
              carry_forward_original,
              carry_forward_balance,
              carry_forward_expiry,
              photourl,
              notes
        FROM profiles
        WHERE
          department = 'Director'
          OR role = 'Manager'
        ORDER BY
          CASE WHEN role = 'Manager' THEN 0 ELSE 1 END,
          department,
          id DESC
      `);

    // =====================
    // MANAGER
    // =====================
    } else if (meData.role?.toLowerCase() === "manager") {

      if (meData.department === 'Director') {
        result = await pool.query(`
          SELECT id, staff_id, full_name, role, position, department, email,
                employment_date, confirmation_date, termination_date,
                gender,
                leave_entitlement_annual_original,
                leave_entitlement_medical_original,
                leave_entitlement_annual,
                leave_entitlement_medical,
                carry_forward_original,
                carry_forward_balance,
                carry_forward_expiry,
                photourl,
                notes
          FROM profiles
          WHERE
            department = 'Director'
            OR role = 'Manager'
          ORDER BY
            CASE WHEN role = 'Manager' THEN 0 ELSE 1 END,
            department,
            id DESC
        `);
      } else {
        result = await pool.query(`
        SELECT id, staff_id, full_name, role, position, department, email,
              employment_date, confirmation_date, termination_date,
              gender,
              leave_entitlement_annual_original,
              leave_entitlement_medical_original,
              leave_entitlement_annual,
              leave_entitlement_medical,
              carry_forward_original,
              carry_forward_balance,
              carry_forward_expiry,
              photourl,
              notes
        FROM profiles p
        WHERE EXISTS (
            SELECT 1
            FROM unnest(string_to_array(p.department, ',')) empDept
            WHERE trim(empDept) = ANY (
                string_to_array($1, ',')
            )
        )
        ORDER BY id DESC
      `, [meData.department]);
            }
    } else {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const defaultAvatar = "/uploads/default-avatar.png";
    
    // ✅ ADD PRORATED CALCULATION TO EACH EMPLOYEE
    const rows = result.rows.map(r => {
      const yearsOfService = calculateYearsOfService(r.employment_date);
      const baseAnnualLeave = getBaseAnnualLeave(yearsOfService);
      const baseMedicalLeave = getBaseMedicalLeave(yearsOfService);
      const proratedAnnualLeave = calculateProratedLeave(r.employment_date, baseAnnualLeave);
      const proratedMedicalLeave = calculateProratedLeave(r.employment_date, baseMedicalLeave);

      return {
        ...r,
        photourl: r.photourl || defaultAvatar,
        leave_entitlement_annual_prorated: proratedAnnualLeave,
        leave_entitlement_medical_prorated: proratedMedicalLeave,
        years_of_service: yearsOfService
      };
    });

    res.json(rows);

  } catch (err) {
    console.error("Error fetching employees:", err);
    res.status(500).json({ error: "Failed to fetch employees" });
  }
});

// ✅ ALSO UPDATE THE /employees ROUTE
router.get("/employees", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM profiles ORDER BY id DESC");
    const defaultAvatar = "/uploads/icontest1.png";

    const rows = result.rows.map(r => {
      const yearsOfService = calculateYearsOfService(r.employment_date);
      const baseAnnualLeave = getBaseAnnualLeave(yearsOfService);
      const baseMedicalLeave = getBaseMedicalLeave(yearsOfService);
      const proratedAnnualLeave = calculateProratedLeave(r.employment_date, baseAnnualLeave);
      const proratedMedicalLeave = calculateProratedLeave(r.employment_date, baseMedicalLeave);

      return {
        ...r,
        photourl: r.photourl || defaultAvatar,
        leave_entitlement_annual_prorated: proratedAnnualLeave,
        leave_entitlement_medical_prorated: proratedMedicalLeave,
        years_of_service: yearsOfService
      };
    });

    res.json(rows);

  } catch (err) {
    console.error("Error fetching employees:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ============================================================
   3) UPDATE EMPLOYEE (WITH AUTO RECALCULATION)
============================================================ */
router.put("/:staff_id", async (req, res) => {
  const staffId = req.params.staff_id;

  const {
    full_name,
    email,
    role,
    position,
    department,
    employment_date,
    confirmation_date,
    termination_date,
    gender,
    notes,
    currentPassword,
    newPassword,
    staff_id,
    photo_url
  } = req.body;

  try {
    /* ------------------------------
       0) GET OLD DATA
    ------------------------------ */
    const oldRow = await pool.query(
      "SELECT email, full_name, password, employment_date FROM profiles WHERE staff_id = $1 LIMIT 1",
      [staffId]
    );

    if (!oldRow.rows.length) {
      return res.status(404).json({ error: "Employee not found." });
    }

    const oldEmail = oldRow.rows[0].email;
    const oldName = oldRow.rows[0].full_name;
    const originalPassword = oldRow.rows[0].password;
    const oldEmploymentDate = oldRow.rows[0].employment_date;

    const emailChanged = oldEmail.trim().toLowerCase() !== (email || "").trim().toLowerCase();
    const employmentDateChanged = oldEmploymentDate !== employment_date;

    /* ------------------------------
       1) PASSWORD CHANGE (Optional)
    ------------------------------ */
    if (currentPassword && newPassword) {
      if (newPassword.length < 8) {
        return res.status(400).json({ error: "New password must be at least 8 characters" });
      }

      const q = await pool.query(
        `SELECT password FROM profiles WHERE staff_id = $1 LIMIT 1`,
        [staffId]
      );

      if (!q.rows.length)
        return res.status(404).json({ error: "User not found." });

      const stored = String(q.rows[0].password ?? "").trim();
      const input = String(currentPassword);

      let isMatch = false;

      if (stored.startsWith("$2")) {
        isMatch = await bcrypt.compare(input, stored);
      } else {
        isMatch = stored === input;
      }

      if (!isMatch) {
        return res.status(400).json({ error: "Current password is incorrect." });
      }

      const hash = await bcrypt.hash(String(newPassword), 12);

      await pool.query(
        `UPDATE profiles
          SET password = $1, updated_at = NOW()
        WHERE staff_id = $2`,
        [hash, staffId]
      );
    }

    /* ------------------------------
       1.5) CHECK IF EMPLOYEE HAS USED ANY LEAVE
    ------------------------------ */
    const usedQuery = await pool.query(
      `SELECT COALESCE(SUM(total_days), 0) as used
      FROM leave_requests
      WHERE staff_id = $1 
      AND leave_type IN ('AL', 'EL')
      AND status = 'approved'`,
      [staffId]
    );

    const daysUsed = Number(usedQuery.rows[0].used);
    const hasUsedLeave = daysUsed > 0;

    console.log('📊 Leave usage check:', { staffId, daysUsed, hasUsedLeave });

    /* ------------------------------
       1.6) AUTO CALCULATE NEW LEAVE ENTITLEMENTS (BOTH PRORATED)
    ------------------------------ */
    const yearsOfService = calculateYearsOfService(employment_date);
    const baseAnnualLeave = getBaseAnnualLeave(yearsOfService);
    const baseMedicalLeave = getBaseMedicalLeave(yearsOfService);
    const proratedAnnualLeave = calculateProratedLeave(employment_date, baseAnnualLeave);
    const proratedMedicalLeave = calculateProratedLeave(employment_date, baseMedicalLeave);

    console.log('📊 Updated Leave Calculation:', {
      staffId,
      employment_date,
      yearsOfService,
      baseAnnualLeave,
      baseMedicalLeave,
      proratedAnnualLeave,
      proratedMedicalLeave,
      hasUsedLeave,
      employmentDateChanged
    });

    /* ------------------------------
       2) PROFILE UPDATE
    ------------------------------ */
    const result = await pool.query(
      `
      UPDATE profiles
        SET staff_id = $1,
            full_name = $2,
            email = $3,
            role = $4,
            position = $5,
            department = $6,
            employment_date = $7,
            confirmation_date = $8,
            termination_date = $9,
            gender = $10,

            -- Always update original (for next year reset)
            leave_entitlement_annual_original = $11::numeric,
            leave_entitlement_medical_original = $12::numeric,
            
            -- Only update current if no leave used yet
            leave_entitlement_annual = CASE 
              WHEN $16 THEN leave_entitlement_annual
              ELSE $11::numeric
            END,
            
            leave_entitlement_medical = CASE 
              WHEN $16 THEN leave_entitlement_medical
              ELSE $12::numeric
            END,

            notes = $13,
            photourl = COALESCE($14, photourl)
      WHERE staff_id = $15
      RETURNING *;
      `,
      [
        staff_id,                  // $1
        full_name,                 // $2
        email,                     // $3
        role,                      // $4
        position,                  // $5
        department,                // $6
        employment_date || null,   // $7
        confirmation_date || null, // $8
        termination_date || null,  // $9
        gender,                    // $10

        proratedAnnualLeave,       // $11 (AUTO CALCULATED - PRORATED)

        proratedMedicalLeave,      // $12 (AUTO CALCULATED - PRORATED)

        notes,                     // $13
        photo_url || null,         // $14
        staffId,                   // $15
        hasUsedLeave               // $16
      ]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Employee not found." });
    }

    await pool.query(
      `UPDATE profiles 
      SET remaining_leave = leave_entitlement_annual + carry_forward_balance
      WHERE staff_id = $1`,
      [staff_id]
    );

    /* ------------------------------
       3) RESEND ORIGINAL TEMP PASSWORD IF EMAIL CHANGED
    ------------------------------ */
    if (emailChanged) {
  const loginUrl = "https://myleave.edsdata.com.my/login";

  const EMAIL_FOOTER = `
    <hr style="margin-top:30px; border:none; border-top:1px solid #eee;" />

    <div style="text-align:center; margin-top:20px; opacity:0.9;">
      <img 
        src="http://edsdata.com.my:3000/frontend/build/images/eftech.logo.png"
        alt="Eftech Energy Solutions"
        style="width:140px; margin-bottom:8px; display:block; margin-left:auto; margin-right:auto;"
      />

      <img 
        src="http://edsdata.com.my:3000/frontend/build/images/myleave.logo.png"
        alt="MyLeave System"
        style="width:110px; display:block; margin-left:auto; margin-right:auto;"
      />

      <p style="font-size:11px; color:#666; margin-top:10px;">
        This email was automatically generated by <b>MyLeave System</b>.<br/>
        Please do not reply to this email.
      </p>
    </div>
  `;

  const transporter = nodemailer.createTransport({
    host: "mail.eftech.com.my",
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  await transporter.sendMail({
    from: '"Eftech HR" <no-reply@eftech.com.my>',
    to: email,
    subject: "Your MyLeave Account – Email Correction",
    html: `
      <p>Hi ${full_name || oldName},</p>

      <p>Your MyLeave account email has been corrected.</p>

      <p>Below are your temporary login credentials:</p>

      <p>
        <b>Email:</b> ${email}<br/>
        <b>Temporary Password:</b> ${originalPassword}
      </p>

      <p>Please follow the steps below:</p>
      <ol>
        <li>Go to the MyLeave system: 
          <a href="${loginUrl}">${loginUrl}</a>
        </li>
        <li>Log in using the temporary password above</li>
        <li>Change your password immediately after logging in</li>
      </ol>

      <p>
        For security reasons, please do not share your login details with anyone.
      </p>

      <p>
        If you face any issues, kindly contact the HR or system administrator.
      </p>

      <p>Thank you,<br/><b>Eftech HR Team</b></p>

      ${EMAIL_FOOTER}
    `
  });
}


    await logAdminAction(
      req, 
      'Updated Employee', 
      `Updated employee profile: ${full_name} (${staff_id}) - AL: ${proratedAnnualLeave} days, MC: ${proratedMedicalLeave} days (${yearsOfService} years service)`
    );

    let message = hasUsedLeave 
      ? `Profile updated. Note: Employee has already used ${daysUsed} days of Annual Leave. New entitlement (AL: ${proratedAnnualLeave} days, MC: ${proratedMedicalLeave} days) will apply from next year's reset.`
      : `Profile updated successfully. Annual Leave: ${proratedAnnualLeave} days, Medical Leave: ${proratedMedicalLeave} days`;

    if (employmentDateChanged) {
      message += ` (Recalculated based on ${yearsOfService} years of service)`;
    }

    res.json({
      success: true,
      message,
      employee: result.rows[0],
      leaveInfo: {
        yearsOfService,
        baseAnnualLeave,
        baseMedicalLeave,
        proratedAnnualLeave,
        proratedMedicalLeave,
        hasUsedLeave,
        daysUsed
      },
      warning: hasUsedLeave ? {
        daysUsed,
        newEntitlement: proratedAnnualLeave,
        appliesNextYear: true
      } : null
    });

  } catch (err) {
    console.error("Error updating employee:", err);
    res.json({
      success: true,
      message: "Profile updated successfully. Notification email could not be delivered."
    });
  }
});

/* ============================================================
   4) DELETE EMPLOYEE
============================================================ */
router.delete("/:staff_id", async (req, res) => {
  try {
    const staffId = req.params.staff_id;

    await pool.query("DELETE FROM leave_requests WHERE staff_id = $1", [staffId]);
    await pool.query("DELETE FROM leave_entitlements WHERE staff_id = $1", [staffId]);
    await pool.query("DELETE FROM profiles WHERE staff_id = $1", [staffId]);

    await logAdminAction(
      req, 
      'Deleted Employee', 
      `Deleted employee: ${staffId}`
    );

    return res.json({ success: true, message: "Employee deleted fully." });

  } catch (err) {
    console.error("Error deleting employee:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ============================================================
   5) GET CURRENT LOGGED-IN USER
============================================================ */
router.get('/me', async (req, res) => {
  try {
    const token = req.cookies['auth_token'];
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    const user = JSON.parse(token);

    const result = await pool.query(
      `SELECT staff_id, full_name, email, role, position, department, photourl
         FROM profiles
        WHERE staff_id = $1`,
      [user.staffId]
    );

    if (!result.rows[0])
      return res.status(404).json({ error: 'User not found' });

    const defaultAvatar = "/uploads/default-avatar.svg";
    res.json({
      staffId: result.rows[0].staff_id,
      name: result.rows[0].full_name,
      email: result.rows[0].email,
      role: result.rows[0].role,
      position: result.rows[0].position,
      department: result.rows[0].department,
      photoUrl: result.rows[0].photourl || "/uploads/default-avatar.png"
    });

  } catch (err) {
    console.error('Failed to fetch current user:', err);
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

/* ============================================================
   6) UPDATE PROFILE PHOTO (DB only)
============================================================ */
router.put('/:staffId/photo', async (req, res) => {
  try {
    const { staffId } = req.params;
    const { photoUrl } = req.body;

    if (!photoUrl) {
      return res.status(400).json({ error: 'photoUrl is required' });
    }

    const result = await pool.query(
      `
      UPDATE profiles
         SET photourl = $1,
             updated_at = NOW()
       WHERE staff_id = $2
       RETURNING photourl;
      `,
      [photoUrl, staffId]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.json({
      success: true,
      message: 'Profile picture updated',
      photoUrl: result.rows[0].photourl
    });

  } catch (err) {
    console.error('Update photo error:', err);
    res.status(500).json({ error: 'Failed to update profile picture' });
  }
});

/* ============================================================
   DEPARTMENT SUMMARY (Dashboard)
============================================================ */
router.get("/department-summary", async (req, res) => {
  console.log("📌 Department summary route loaded");
  try {
    const result = await pool.query(`
      SELECT 
        department AS name,
        COUNT(*)::int AS count
      FROM profiles
      WHERE department IS NOT NULL
        AND department <> ''
        AND termination_date IS NULL
      GROUP BY department
      ORDER BY department ASC
    `);

    const filtered = result.rows.filter(r => r.name !== "Administrator");

    res.json({ departments: filtered });

  } catch (err) {
    console.error("Error loading dept summary:", err);
    res.status(500).json({ error: "Failed to load department summary" });
  }
});

export default router;