import express from 'express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

import pool from './src/db.js';
import profileRoutes from './src/routes/profile.js';
import uploadRoute from './src/routes/uploadRoute.js';
import holidayRoutes from './src/routes/holidayRoutes.js';
import authRoutes from './src/routes/authRoutes.js';


dotenv.config();

const app = express();

// ============================
// Middleware
// ============================
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(bodyParser.json());
app.use(cookieParser());

// static uploads folder
app.use('/uploads', express.static('uploads'));

// ============================
// ROUTES
// ============================
app.use('/api/employee', profileRoutes);
app.use('/api/upload', uploadRoute);
app.use('/api/holidays', holidayRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/employee', profileRoutes); // singular 'employee'

// ============================
// HELPER
// ============================
function roleRedirect(role) {
  const r = String(role || '').toLowerCase();
  if (r === 'admin') return '/dashboard/admin';
  if (r === 'manager') return '/dashboard/manager';
  return '/dashboard/staff';
}

// ============================
// LOGIN
// ============================
app.post('/api/login', async (req, res) => {
  try {
    let { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    email = String(email).trim().toLowerCase();

    const q = await pool.query(
      `SELECT id, staff_id, full_name, email, role, photourl,
              TRIM(CAST(password AS TEXT)) AS password
         FROM profiles
        WHERE LOWER(email) = $1
        LIMIT 1`,
      [email]
    );

    if (!q.rows.length) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const user = q.rows[0];
    const storedRaw = user.password ?? '';
    const stored = String(storedRaw).trim();
    const input = String(password);

    console.log('🔐 Login attempt:', {
      email,
      hasStored: stored.length > 0,
      isBcrypt: stored.startsWith('$2'),
      storedLen: stored.length
    });

    let ok = false;
    try {
      if (stored.startsWith('$2')) {
        ok = await bcrypt.compare(input, stored); // bcrypt hashed password
      } else {
        ok = stored === input; // legacy plaintext
      }
    } catch (err) {
      console.warn('compare error, fallback to plaintext');
      ok = stored === input;
    }

    if (!ok) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    // set cookie payload
    const payload = {
      staffId: user.staff_id,
      email: user.email,
      role: user.role,
      name: user.full_name,
      photoUrl: user.photourl
    };

    res.cookie('auth_token', JSON.stringify(payload), {
      httpOnly: false, // same as before
      sameSite: 'lax'
      // secure: true // enable if running HTTPS
    });

    return res.json({
      success: true,
      redirectTo: roleRedirect(user.role)
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ============================
// WHO AM I (PHOTO)
// ============================
app.get('/api/me/photo', async (req, res) => {
  try {
    const token = req.cookies['auth_token'];
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    const me = JSON.parse(token);
    const q = await pool.query(
      'SELECT staff_id, full_name, email, role, photourl FROM profiles WHERE staff_id = $1 LIMIT 1',
      [me.staffId]
    );
    if (!q.rows.length) return res.status(404).json({ error: 'User not found' });

    const u = q.rows[0];
    return res.json({
      staffId: u.staff_id,
      name: u.full_name,
      email: u.email,
      role: u.role,
      photoUrl: u.photourl
    });
  } catch (e) {
    console.error('GET /api/me/photo error:', e);
    return res.status(500).json({ error: 'Failed to fetch user photo' });
  }
});

// ============================
// WHO AM I (BASIC)
// ============================
// ============================
// CHANGE PASSWORD (by staffId)  <-- HOTFIX
// ============================
app.put('/api/employee/:staffId/password', async (req, res) => {
  try {
    const { staffId } = req.params;
    const { currentPassword, newPassword } = req.body || {};

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'currentPassword and newPassword are required' });
    }
    if (String(newPassword).length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    // Ambil user dari table yang sama dengan login (profiles)
    const q = await pool.query(
      `SELECT id, staff_id, email, role, photourl,
              TRIM(CAST(password AS TEXT)) AS password
         FROM profiles
        WHERE staff_id = $1
        LIMIT 1`,
      [staffId]
    );

    if (!q.rows.length) {
      return res.status(404).json({ error: 'Staff not found' });
    }

    const user = q.rows[0];
    const stored = String(user.password ?? '').trim();
    const input = String(currentPassword);

    // Sama logic macam /api/login: support bcrypt ATAU legacy plaintext
    let ok = false;
    try {
      if (stored.startsWith('$2')) {
        ok = await bcrypt.compare(input, stored); // bcrypt
      } else {
        ok = stored === input; // plaintext legacy
      }
    } catch (e) {
      ok = stored === input;
    }

    if (!ok) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Hash password baru (guna bcrypt) — login dah support detect hash
    const hash = await bcrypt.hash(String(newPassword), 12);

    await pool.query(
      `UPDATE profiles
          SET password = $1, updated_at = NOW()
        WHERE staff_id = $2`,
      [hash, staffId]
    );

    return res.json({ success: true, message: 'Password updated' });
  } catch (e) {
    console.error('PUT /api/employee/:staffId/password error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ============================
// START SERVER
// ============================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 API running at http://localhost:${PORT}`);
});
