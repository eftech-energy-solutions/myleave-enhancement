import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import pool from '../db.js';
import dotenv from 'dotenv';
import { logAdminAction } from '../middleware/adminLogger.js';
import { sendPasswordResetOtp } from '../utils/emailTemplates.js';
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

const router = express.Router();

// ============================
// LOGIN
// ============================
router.post('/login', async (req, res) => {
  try {
    let { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    email = String(email).trim().toLowerCase();

    const q = await pool.query(
      `SELECT staff_id, full_name, email, role, department, photourl,
              TRIM(CAST(password AS TEXT)) AS password
         FROM profiles
        WHERE LOWER(email) = $1
        LIMIT 1`,
      [email]
    );

    if (!q.rows.length) {
      return res.status(400).json({ error: 'Email is wrong' });
    }

    const user = q.rows[0];

    // 🔐 support plaintext + bcrypt
    const stored = String(user.password || '').trim();
    let ok = false;

    if (stored.startsWith('$2')) {
      ok = await bcrypt.compare(password, stored);
    } else {
      ok = password === stored;
    }

    if (!ok) {
      return res.status(400).json({ error: 'Wrong password' });
    }

    // role override
    const overrideQ = await pool.query(
      `SELECT role FROM role_setting WHERE LOWER(email)=LOWER($1) LIMIT 1`,
      [email]
    );

    let finalRole = overrideQ.rows.length
      ? overrideQ.rows[0].role
      : user.role;

    res.cookie(
      'auth_token',
      JSON.stringify({
        staffId: user.staff_id,
        email: user.email,
        name: user.full_name,
        role: finalRole,
        department: user.department,
        photoUrl: user.photourl
      }),
      {
        httpOnly: false,
        sameSite: 'lax',
        path: '/'
      }
    );

    const role = String(finalRole || '').toLowerCase();

    let redirectTo = '/dashboard/staff';

    if (role === 'admin') {
      redirectTo = '/dashboard/admin';
    } else if (role === 'manager') {
      redirectTo = '/dashboard/manager';
    } else if (role === 'director') {
      redirectTo = '/dashboard/director';
    }

    return res.json({ success: true, redirectTo });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Server error' });
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
const stored = String(user.password || '').trim();

let match = false;

// 🔐 Support BOTH: plaintext temp password & bcrypt hash
if (stored.startsWith('$2')) {
  // hashed password
  match = await bcrypt.compare(currentPassword.trim(), stored);
} else {
  // plaintext (first-time login temp password)
  match = currentPassword.trim() === stored;
}

if (!match) {
  return res.status(400).json({
    error: 'Current password is incorrect'
  });
}

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

    try {
      await sendPasswordResetOtp(email, otp);
      res.json({ success: true, message: 'OTP sent to email' });
    } catch (emailErr) {
      console.error("Failed to send OTP email:", emailErr.message);
      res.json({ success: true, message: 'OTP generated but email delivery failed. Contact HR.' });
    }
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