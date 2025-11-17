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

    await pool.query(
      `INSERT INTO profiles (
        staff_id, full_name, email, password, role, department,
        employment_date, confirmation_date, termination_date, gender,
        leave_entitlement_annual, leave_entitlement_medical, notes, photourl
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        empId,
        name,
        email,
        randomPassword,
        role,
        department,
        employmentDate || null,
        confirmationDate || null,
        terminationDate || null,
        gender,
        annualLeave,
        medicalLeave,
        notes,
        photoUrl
      ]
    );

    const transporter = nodemailer.createTransport({
      host: "mail.eftech.com.my",
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    // Email to employee
    await transporter.sendMail({
      from: '"Eftech HR" <no-reply@eftech.com.my>',
      to: email,
      subject: "Your MyLeave Account",
      text: `Hi ${name},\n\nYour MyLeave account has been created.\n\nEmail: ${email}\nPassword: ${randomPassword}\n\nPlease log in and change your password.`,
    });

    // Email admin
    await transporter.sendMail({
      from: '"Eftech HR" <no-reply@eftech.com.my>',
      to: "aziraazman0105@gmail.com",
      subject: `New employee added: ${name}`,
      text: `New employee added:\n\nName: ${name}\nEmail: ${email}\nRole: ${role}\nPassword: ${randomPassword}`,
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
        SELECT id, staff_id, full_name, role, department, email,
               employment_date, confirmation_date, termination_date,
               gender, leave_entitlement_annual, leave_entitlement_medical,
               photourl, notes
          FROM profiles
        ORDER BY id DESC
      `);

    // MANAGER → only same department
    } else if (meData.role?.toLowerCase() === "manager") {
      result = await pool.query(`
        SELECT id, staff_id, full_name, role, department, email,
               employment_date, confirmation_date, termination_date,
               gender, leave_entitlement_annual, leave_entitlement_medical,
               photourl, notes
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

<<<<<<< Updated upstream

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
=======
>>>>>>> Stashed changes
/* ============================================================
   3) MERGED UPDATE EMPLOYEE (Profile + Optional Password)
============================================================ */
router.put("/:staff_id", async (req, res) => {
  const staffId = req.params.staff_id;

  const {
    full_name,
    email,
    role,
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
       2) PROFILE UPDATE
    ------------------------------ */
    const result = await pool.query(
      `
      UPDATE profiles
         SET staff_id                = $1,
             full_name              = $2,
             email                  = $3,
             role                   = $4,
             department             = $5,
             employment_date        = $6,
             confirmation_date      = $7,
             termination_date       = $8,
             gender                 = $9,
             leave_entitlement_annual  = $10,
             leave_entitlement_medical = $11,
             notes                  = $12,
             photourl               = COALESCE($13, photourl)
       WHERE staff_id = $14
       RETURNING *;
      `,
      [
        staff_id,                  // $1 – staff_id baru (dari form)
        full_name,                 // $2
        email,                     // $3
        role,                      // $4
        department,                // $5
        employment_date || null,   // $6
        confirmation_date || null, // $7
        termination_date || null,  // $8
        gender,                    // $9
        (leave_entitlement_annual == null || leave_entitlement_annual === "" ? null : Number(leave_entitlement_annual)), // $10
        (leave_entitlement_medical == null || leave_entitlement_medical === "" ? null : Number(leave_entitlement_medical)), // $11
        notes,                     // $12
        photo_url || null,         // $13
        staffId                    // $14 – staff_id lama
      ]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Employee not found." });
    }

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
      message: "Profile updated successfully",
      employee: result.rows[0]
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

    const result = await pool.query(
      "DELETE FROM profiles WHERE staff_id = $1",
      [staffId]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Employee not found." });
    }

    res.json({ success: true, message: "Employee deleted successfully." });

  } catch (err) {
    console.error("Error deleting employee:", err);
    res.status(500).json({ error: "Failed to delete employee." });
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
      `SELECT staff_id, full_name, email, role, department, photourl
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
