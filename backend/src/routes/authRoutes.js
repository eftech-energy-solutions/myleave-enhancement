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
const otpStore = new Map(); // key: email, value: { codeHash, expiresAt, tries, resetToken, tokenExp }

// Helper
function gen6() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
}

// ========== 1) Request OTP ==========
router.post("/auth/request-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: "Email required" });

    const code = gen6();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 min
    otpStore.set(email.toLowerCase(), { codeHash, expiresAt, tries: 0 });

    // TODO: hantar email/SMS di sini. Untuk dev, return code.
    return res.json({ success: true, message: "OTP sent", devCode: code });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// ========== 2) Verify OTP (beri resetToken jika betul) ==========
router.post("/auth/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    const rec = otpStore.get((email || "").toLowerCase());
    if (!rec) return res.status(400).json({ success: false, error: "OTP not requested" });
    if (Date.now() > rec.expiresAt) {
      otpStore.delete(email.toLowerCase());
      return res.status(400).json({ success: false, error: "OTP expired" });
    }
    rec.tries++;
    if (rec.tries > 5) {
      otpStore.delete(email.toLowerCase());
      return res.status(429).json({ success: false, error: "Too many attempts" });
    }
    const ok = await bcrypt.compare(String(otp || ""), rec.codeHash);
    if (!ok) return res.status(400).json({ success: false, error: "Wrong OTP number" });

    // Success → issue short-lived reset token
    const resetToken = crypto.randomBytes(24).toString("hex");
    rec.resetToken = resetToken;
    rec.tokenExp = Date.now() + 10 * 60 * 1000; // 10 min
    return res.json({ success: true, resetToken });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// ========== 3) Reset password dengan resetToken ==========
router.post("/auth/reset-password-with-otp", async (req, res) => {
  try {
    const { email, resetToken, newPassword } = req.body;
    if (!email || !resetToken || !newPassword)
      return res.status(400).json({ success: false, error: "Missing fields" });

    const rec = otpStore.get(email.toLowerCase());
    if (!rec || rec.resetToken !== resetToken || Date.now() > rec.tokenExp) {
      return res.status(400).json({ success: false, error: "Invalid or expired token" });
    }

    // === UPDATE PASSWORD DALAM DB ===
    const hash = await bcrypt.hash(newPassword, 10);
    // Contoh table users by email — adjust ikut schema kau:
    await pool.query("UPDATE users SET password=$1 WHERE email=$2", [hash, email.toLowerCase()]);

    // clear token
    otpStore.delete(email.toLowerCase());

    return res.json({ success: true, message: "Password updated" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, error: "Server error" });
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
