import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import pool from '../db.js';
import dotenv from 'dotenv';
dotenv.config();

const router = express.Router();

// ---------- SMTP transporter ----------
const transporter = nodemailer.createTransport({
  host: "mail.eftech.com.my",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  // uncomment if you see SSL/self-signed errors in logs
  // tls: { rejectUnauthorized: false }
});

// verify once on server start
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ SMTP connection error:', error.message);
  } else {
    console.log('✅ SMTP server is ready to send emails');
  }
});
// ---------- LOGIN ----------
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: "Missing fields" });

    const userRes = await pool.query(
      "SELECT staff_id, full_name, email, role, department, password, photourl FROM profiles WHERE LOWER(email)=LOWER($1) LIMIT 1",
      [email]
    );

    // ❌ EMAIL TAK WUJUD
    if (userRes.rows.length === 0) {
      return res.status(400).json({
        error: "Email is wrong"
      });
    }

    const user = userRes.rows[0];

    // ❌ PASSWORD SALAH
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).json({
        error: "Wrong password"
      });
    }

    // ✅ LOGIN BERJAYA — JANGAN SENTUH
   let finalRole = user.role;

        // 2) OPTIONAL: override role ikut email (kalau guna table role_setting)
        const overrideQ = await pool.query(
          `SELECT role FROM role_setting WHERE LOWER(email) = LOWER($1) LIMIT 1`,
          [email]
        );

        if (overrideQ.rows.length) {
          finalRole = overrideQ.rows[0].role;
        }

        // 3) SET AUTH TOKEN (SATU COOKIE SAHAJA)
        res.cookie("auth_token", JSON.stringify({
          staffId: user.staff_id,
          name: user.full_name,
          email: user.email,
          role: finalRole,
          department: user.department,
          photoUrl: user.photourl
        }), {
          httpOnly: true,
          sameSite: "lax",
          maxAge: 7 * 24 * 60 * 60 * 1000
        });

        // 4) REDIRECT IKUT ROLE
        let redirectTo = "/dashboard/staff";
        if (String(finalRole).toLowerCase() === "admin") redirectTo = "/dashboard/admin";
        if (String(finalRole).toLowerCase() === "manager") redirectTo = "/dashboard/manager";

        return res.json({ success: true, redirectTo });

          } catch (err) {
            console.error("Login error:", err);
            res.status(500).json({ error: "Server error" });
          }
        });


// ---------- CHANGE PASSWORD (email + current + new) ----------
router.post('/change-password', async (req, res) => {
  try {
    const { email, currentPassword, newPassword } = req.body;
    if (!email || !currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    const result = await pool.query(
      'SELECT password FROM profiles WHERE email = $1 LIMIT 1',
      [email]
    );
    if (!result.rows.length) return res.status(400).json({ error: 'User not found' });

    const user = result.rows[0];
    const stored = user.password || '';
    let ok = false;

    // support both hashed + plaintext current password
    try {
      if (stored.startsWith('$2')) ok = await bcrypt.compare(currentPassword, stored);
      else ok = stored === currentPassword;
    } catch {
      ok = stored === currentPassword;
    }

    if (!ok) return res.status(400).json({ error: 'Current password is incorrect' });

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE profiles SET password=$1, last_password_change=now() WHERE email=$2',
      [hashed, email]
    );

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// ---------- FORGOT PASSWORD (send OTP) ----------
router.post('/forgot', async (req, res) => {
  try {
    const emailRaw = req.body?.email;
    const email = String(emailRaw || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const userRes = await pool.query('SELECT email FROM profiles WHERE LOWER(email)=LOWER($1) LIMIT 1', [email]);

    // Always respond success to avoid email enumeration
    if (!userRes.rows.length) return res.json({ success: true });

    const otp = (Math.floor(100000 + Math.random() * 900000)).toString(); // 6-digit
    const otpHash = await bcrypt.hash(otp, 10);
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await pool.query(
      'INSERT INTO password_resets (user_email, otp_hash, expires_at) VALUES ($1,$2,$3)',
      [email, otpHash, expires]
    );

    await transporter.sendMail({
      from: '"Eftech HR" <no-reply@eftech.com.my>',
      to: email,
      subject: 'Password Reset Code',
      text: `Your OTP code is ${otp}. It will expire in 10 minutes.`
    });

    res.json({ success: true, message: 'OTP sent to email' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});
// ---------- VERIFY OTP (step 1 sebelum set password) ----------
router.post('/verify-otp', async (req, res) => {
  try {
    const { email: emailRaw, otp: otpRaw } = req.body || {};
    const email = String(emailRaw || '').trim().toLowerCase();
    const otp = String(otpRaw || '').trim();

    if (!email || !otp) {
      return res.status(400).json({ error: 'Missing email or OTP' });
    }

    // Ambil latest, unused OTP untuk email ni
    const resets = await pool.query(
      `SELECT id, otp_hash, expires_at, used
         FROM password_resets
        WHERE user_email=$1 AND used=false
        ORDER BY created_at DESC
        LIMIT 1`,
      [email]
    );

    if (!resets.rows.length) {
      return res.status(400).json({ error: 'OTP not found' });
    }

    const record = resets.rows[0];

    // Expired?
    if (record.used || new Date() > record.expires_at) {
      return res.status(400).json({ error: 'OTP expired' });
    }

    // Check OTP
    const valid = await bcrypt.compare(otp, record.otp_hash);
    if (!valid) {
      return res.status(400).json({ error: 'Wrong OTP number.' });
    }

    // ✅ OTP sah – jangan mark used dulu, bagi chance dia reset password
    return res.json({ success: true });
  } catch (err) {
    console.error('Verify OTP error:', err);
    return res.status(500).json({ error: 'Server error while verifying OTP.' });
  }
});

// ---------- RESET PASSWORD (verify OTP, set new) ----------
router.post('/reset', async (req, res) => {
  try {
    const { email: emailRaw, otp: otpRaw, newPassword } = req.body || {};
    const email = String(emailRaw || '').trim().toLowerCase();
    const otp = String(otpRaw || '').trim();

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: 'Missing fields' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // latest unused OTP
    const resets = await pool.query(
      `SELECT id, otp_hash, expires_at, used
         FROM password_resets
        WHERE user_email=$1 AND used=false
        ORDER BY created_at DESC
        LIMIT 1`,
      [email]
    );
    if (!resets.rows.length) return res.status(400).json({ error: 'OTP not found' });

    const record = resets.rows[0];
    if (record.used || new Date() > record.expires_at) {
      return res.status(400).json({ error: 'OTP expired' });
    }

    const valid = await bcrypt.compare(otp, record.otp_hash);
    if (!valid) return res.status(400).json({ error: 'Invalid OTP' });

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE profiles SET password=$1, last_password_change=now() WHERE LOWER(email)=LOWER($2)',
      [hash, email]
    );
    await pool.query('UPDATE password_resets SET used=true WHERE id=$1', [record.id]);

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

export default router;