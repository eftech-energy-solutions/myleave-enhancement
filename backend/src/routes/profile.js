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


export default router;
