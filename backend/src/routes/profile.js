import express from 'express';
import pool from '../db.js';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
const router = express.Router();

// Add new employee
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
    // 1️⃣ Generate random password
    const randomPassword = crypto.randomBytes(6).toString('hex');

    // 2️⃣ Insert new employee into DB
    await pool.query(
      `INSERT INTO profiles (
        staff_id, full_name, email, password, role, department,
        employment_date, confirmation_date, termination_date, gender,
        leave_entitlement_annual, leave_entitlement_medical, notes, photoUrl
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [ 
        empId,
        name,
        email,
        randomPassword, // nanti boleh encrypt
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

    // 3️⃣ Setup transporter untuk email (guna mail eftech)
    const transporter = nodemailer.createTransport({
      host: "mail.eftech.com.my",
      port: 465,
      secure: true, // true for port 465, false for 587
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    // 4️⃣ Send email ke employee
    await transporter.sendMail({
      from: '"Eftech HR" <no-reply@eftech.com.my>',
      to: email,
      subject: "Your MyLeave Account",
      text: `Hi ${name},\n\nYour MyLeave account has been created.\n\nEmail: ${email}\nPassword: ${randomPassword}\n\nPlease log in and change your password.`,
    });

    // 5️⃣ Send email ke admin
    await transporter.sendMail({
      from: '"Eftech HR" <no-reply@eftech.com.my>',
      to: "aziraazman0105@gmail.com",
      subject: `New employee added: ${name}`,
      text: `New employee added:\n\nName: ${name}\nEmail: ${email}\nPosition: ${role}\nPassword: ${randomPassword}`,
    });

    res.json({ success: true, message: 'Employee added and emails sent.' });
  } catch (err) {
    console.error('Error adding employee:', err);
    res.status(500).json({ error: 'Database or email error' });
  }
});

// ✅ Fetch all employees
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, staff_id, full_name, role, department, email, employment_date, confirmation_date, termination_date, gender, leave_entitlement_annual, leave_entitlement_medical, photourl, notes FROM profiles ORDER BY id DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching employees:", err);
    res.status(500).json({ error: "Failed to fetch employees" });
  }
});

// GET /api/employees
router.get("/employees", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM profiles ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Update employee (Edit)
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
    notes
  } = req.body;

  try {
    const query = `
      UPDATE profiles
      SET full_name = $1,
          email = $2,
          role = $3,
          department = $4,
          employment_date = $5,
          confirmation_date = $6,
          termination_date = $7,
          gender = $8,
          leave_entitlement_annual = $9,
          leave_entitlement_medical = $10,
          notes = $11
      WHERE staff_id = $12
      RETURNING *;
    `;

    const result = await pool.query(query, [
      full_name,
      email,
      role,
      department,
      employment_date || null,
      confirmation_date || null,
      termination_date || null,
      gender,
      leave_entitlement_annual,
      leave_entitlement_medical,
      notes,
      staffId
    ]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Employee not found." });
    }

    res.json({ success: true, employee: result.rows[0] });
  } catch (err) {
    console.error("Error updating employee:", err);
    res.status(500).json({ error: "Failed to update employee." });
  }
});


// ✅ Delete employee
router.delete("/:staff_id", async (req, res) => {
  const staffId = req.params.staff_id;

  try {
    const result = await pool.query("DELETE FROM profiles WHERE staff_id = $1", [staffId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Employee not found." });
    }

    res.json({ success: true, message: "Employee deleted successfully." });
  } catch (err) {
    console.error("Error deleting employee:", err);
    res.status(500).json({ error: "Failed to delete employee." });
  }
});

// ------------------- Get current logged-in user -------------------
router.get('/me', async (req, res) => {
  try {
    const token = req.cookies['auth_token'];
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    const user = JSON.parse(token);

    const result = await pool.query(
      'SELECT staff_id, full_name, email, role, photourl FROM profiles WHERE staff_id = $1',
      [user.staffId]
    );

    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });

    res.json({
      staffId: result.rows[0].staff_id,
      name: result.rows[0].full_name,
      email: result.rows[0].email,
      role: result.rows[0].role,
      photoUrl: result.rows[0].photourl,
    });
  } catch (err) {
    console.error('Failed to fetch current user:', err);
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

export default router;
