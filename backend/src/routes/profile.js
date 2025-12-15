import express from 'express';
import pool from '../db.js';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const router = express.Router();

/* ============================================================
   1) ADD NEW EMPLOYEE
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
    annualLeave,
    medicalLeave,
    notes,
    photoUrl
  } = req.body;

  try {
    const randomPassword = crypto.randomBytes(6).toString('hex');

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

    -- Original fields (never change)
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

    annualLeave,              // $12 (original)
    medicalLeave,             // $13 (original)
    
    annualLeave,              // $14 (current - same as original) ✅
    medicalLeave,             // $15 (current - same as original) ✅
    
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

    // EMAIL TO EMPLOYEE
    await transporter.sendMail({
      from: '"Eftech HR" <no-reply@eftech.com.my>',
      to: email,
      subject: "Your MyLeave Account",
      text: `Hi ${name},\n\nYour MyLeave account has been created.\n\nEmail: ${email}\nPassword: ${randomPassword}\n\nPlease log in and change your password.`,
    });

    // EMAIL TO ADMIN
    await transporter.sendMail({
      from: '"Eftech HR" <no-reply@eftech.com.my>',
      to: "aziraazman0105@gmail.com",
      subject: `New employee added: ${name}`,
      text: `New employee added:\n\nName: ${name}\nEmail: ${email}\nRole: ${role}\nPosition: ${position}\nPassword: ${randomPassword}`,
    });

    res.json({ success: true, message: 'Employee added and emails sent.' });

  } catch (err) {
    console.error('Error adding employee:', err);
    res.status(500).json({ error: 'Database or email error' });
  }
});
/* ============================================================
   2) GET ALL EMPLOYEES
============================================================ */
router.get("/", async (req, res) => {
  try {
    const token = req.cookies['auth_token'];
    if (!token) return res.status(401).json({ error: "Not authenticated" });

    const me = JSON.parse(token);

    // get logged-in user's department + role
    const meQuery = await pool.query(
      `SELECT role, department FROM profiles WHERE staff_id = $1 LIMIT 1`,
      [me.staffId]
    );

    if (!meQuery.rows.length)
      return res.status(404).json({ error: "User not found" });

    const meData = meQuery.rows[0];
    let result;

    // ADMIN → see all
    if (meData.role?.toLowerCase() === "admin") {
    result = await pool.query(`
      SELECT id, staff_id, full_name, role, position, department, email,
            employment_date, confirmation_date, termination_date,
            gender,
            leave_entitlement_annual_original,
            leave_entitlement_medical_original,
            carry_forward_original,
            carry_forward_balance,
            carry_forward_expiry,
            photourl,
            notes
        FROM profiles
      ORDER BY id DESC
    `);

    // MANAGER → only same department
    } else if (meData.role?.toLowerCase() === "manager") {
      result = await pool.query(`
      SELECT id, staff_id, full_name, role, position, department, email,
            employment_date, confirmation_date, termination_date,
            gender,
            leave_entitlement_annual_original,
            leave_entitlement_medical_original,
            carry_forward_original,
            carry_forward_balance,
            carry_forward_expiry,
            photourl,
            notes
      FROM profiles
      WHERE department = $1
      ORDER BY id DESC
      `, [meData.department]);

    // STAFF → cannot see
    } else {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const defaultAvatar = "/uploads/default-avatar.png";
    const rows = result.rows.map(r => ({
      ...r,
      photourl: r.photourl || defaultAvatar
    }));

    res.json(rows);

  } catch (err) {
    console.error("Error fetching employees:", err);
    res.status(500).json({ error: "Failed to fetch employees" });
  }
});


// Additional direct full-table GET
router.get("/employees", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM profiles ORDER BY id DESC");

    const defaultAvatar = "/uploads/icontest1.png";

    const rows = result.rows.map(r => ({
      ...r,
      photourl: r.photourl || defaultAvatar
    }));

    res.json(rows);

  } catch (err) {
    console.error("Error fetching employees:", err);
    res.status(500).json({ error: err.message });
  }
});
/* ============================================================
   3) MERGED UPDATE EMPLOYEE (Profile + Optional Password)
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
    leave_entitlement_annual,
    leave_entitlement_medical,
    notes,
    currentPassword,
    newPassword,
    staff_id,   // NEW: staff ID baru yg user edit dlm form
    photo_url
  } = req.body;

  try {
    /* ------------------------------
       0) GET OLD EMAIL + ORIGINAL PASSWORD
    ------------------------------ */
    const oldRow = await pool.query(
      "SELECT email, full_name, password FROM profiles WHERE staff_id = $1 LIMIT 1",
      [staffId]
    );

    if (!oldRow.rows.length) {
      return res.status(404).json({ error: "Employee not found." });
    }

    const oldEmail = oldRow.rows[0].email;
    const oldName = oldRow.rows[0].full_name;
    const originalPassword = oldRow.rows[0].password;

    const emailChanged = oldEmail.trim().toLowerCase() !== (email || "").trim().toLowerCase();

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

    (leave_entitlement_annual == null || leave_entitlement_annual === "" 
        ? null 
        : Number(leave_entitlement_annual)),    // $11

    (leave_entitlement_medical == null || leave_entitlement_medical === "" 
        ? null 
        : Number(leave_entitlement_medical)),    // $12

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
      [staff_id]  // Use NEW staff_id in case it was changed
    );

    /* ------------------------------
       3) RESEND ORIGINAL TEMP PASSWORD IF EMAIL CHANGED
    ------------------------------ */
    if (emailChanged) {
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
        to: email, // email baru yang betul
        subject: "Your MyLeave Account (Corrected Email)",
        text: `Hi ${full_name || oldName},

Your MyLeave account email has been corrected.

Here is your temporary password:

Email: ${email}
Temporary Password: ${originalPassword}

Please log in and change your password.

Thank you.`
      });
    }

res.json({
      success: true,
      message: hasUsedLeave 
        ? `Profile updated. Note: Employee has already used ${daysUsed} days of Annual Leave. New entitlement (${leave_entitlement_annual} days) will apply from next year's reset.`
        : 'Profile updated successfully',
      employee: result.rows[0],
      warning: hasUsedLeave ? {
        daysUsed,
        newEntitlement: leave_entitlement_annual,
        appliesNextYear: true
      } : null
    });

  } catch (err) {
    console.error("Error updating employee:", err);
    res.status(500).json({ error: "Failed to update employee." });
  }
});

/* ============================================================
   4) DELETE EMPLOYEE
============================================================ */
router.delete("/:staff_id", async (req, res) => {
  try {
    const staffId = req.params.staff_id;

    // Delete all leave requests for this staff
    await pool.query("DELETE FROM leave_requests WHERE staff_id = $1", [staffId]);

    // Delete leave entitlements
    await pool.query("DELETE FROM leave_entitlements WHERE staff_id = $1", [staffId]);

    // Delete profile (main table)
    await pool.query("DELETE FROM profiles WHERE staff_id = $1", [staffId]);

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
