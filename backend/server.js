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
import dashboardRoutes from './src/routes/dashboardRoutes.js';
import roleSettingRoute from "./src/routes/roleSettingRoute.js";
import leaveRequestsRoutes from "./src/routes/leaveRequests.js";

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
app.use(async (req, res, next) => {
  try {
    const token = req.cookies["auth_token"];
    if (!token) return next();

    const basic = JSON.parse(token); // { staffId, name, role, ... maybe }
    if (!basic?.staffId) return next();

    const { rows } = await pool.query(
      `SELECT staff_id, full_name, email, role, department, position
         FROM profiles
        WHERE staff_id = $1
        LIMIT 1`,
      [basic.staffId]
    );

    if (rows[0]) {
      console.log("ATTACH USER:", rows[0]);
      req.user = rows[0]; // 🎯 ini yang POST /leave-requests guna
    }
    return next();
  } catch (err) {
    console.error("attachUser error:", err);
    return next(); // jangan block request, cuma tak ada req.user
  }
});
app.use('/api/employee', profileRoutes);
app.use('/api/upload', uploadRoute);
app.use('/api/holidays', holidayRoutes);
app.use('/api/auth', authRoutes);
app.use('/uploads', express.static('uploads'));
app.use("/api", roleSettingRoute);
app.use("/api/leave-requests", leaveRequestsRoutes);

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

    // ====== FETCH USER ASAL ======
    const q = await pool.query(
      `SELECT id, staff_id, full_name, email, role, photourl, department,
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

    // ====== PASSWORD CHECK ======
    const stored = String(user.password ?? '').trim();
    const input = String(password);

    let ok = false;
    try {
      if (stored.startsWith('$2')) {
        ok = await bcrypt.compare(input, stored);
      } else {
        ok = stored === input;
      }
    } catch (err) {
      ok = stored === input;
    }

    if (!ok) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    // ======================================================
    // CHECK ROLE OVERRIDE DARI role_setting
    // ======================================================
    const overrideQ = await pool.query(
      `SELECT role FROM role_setting WHERE LOWER(email) = $1 LIMIT 1`,
      [email]
    );

    let finalRole = user.role; // default

    if (overrideQ.rows.length) {
      finalRole = overrideQ.rows[0].role;  // override dari table role_setting
      console.log("🔄 Role override applied:", finalRole);
    } else {
      console.log("➡ No override, using default role:", finalRole);
    }

    // =======================================================
    // SET COOKIE PAYLOAD (role sudah override)
    // =======================================================
    const payload = {
      staffId: user.staff_id,
      email: user.email,
      role: finalRole,          // ← guna finalRole
      name: user.full_name,
      department: user.department,
      photoUrl: user.photourl,
      position: user.position
    };

    res.cookie('auth_token', JSON.stringify(payload), {
      httpOnly: false,
      sameSite: 'lax',
      path: '/',
    });

    return res.json({
      success: true,
      redirectTo: roleRedirect(finalRole) // ← guna finalRole
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
      'SELECT staff_id, full_name, email, role, position, department, photourl FROM profiles WHERE staff_id = $1 LIMIT 1',
      [me.staffId]
    );
    if (!q.rows.length) return res.status(404).json({ error: 'User not found' });

    const u = q.rows[0];
    return res.json({
      staffId: u.staff_id,
      name: u.full_name,
      email: u.email,
      position: u.position,
      role: u.role,
      department: u.department,  
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

app.get('/api/me', async (req, res) => {
  try {
    const token = req.cookies["auth_token"];
    if (!token) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const me = JSON.parse(token);

    // 1) Get basic profile info
    const profileQ = await pool.query(
      `SELECT 
        staff_id,
        full_name,
        email,
        role,
        position,
        department,
        photourl,
        leave_entitlement_annual,
        leave_entitlement_medical,
        leave_entitlement_annual_original,
        leave_entitlement_medical_original,
        carry_forward_balance,
        carry_forward_original,
        carry_forward_expiry,
        remaining_leave
      FROM profiles
      WHERE staff_id = $1
      LIMIT 1`,
      [me.staffId]
    );

    if (!profileQ.rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    const profile = profileQ.rows[0];

    // 2) Get hospitalization leave from leave_entitlements table
    const hospQ = await pool.query(
      `SELECT entitlement, balance
       FROM leave_entitlements
       WHERE staff_id = $1 AND leave_type = 'HOSP'
       LIMIT 1`,
      [me.staffId]
    );

    const hosp = hospQ.rows.length
      ? hospQ.rows[0]
      : { entitlement: 60, balance: 60 }; // fallback if not exist

    // 3) Combine and return all data
    return res.json({
      ...profile,
      hosp_entitlement: hosp.entitlement,
      hosp_balance: hosp.balance
    });

  } catch (err) {
    console.error("GET /api/me error:", err);
    return res.status(500).json({ error: "Failed to fetch user data" });
  }
});



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
      `SELECT id, staff_id, email, role, position, photourl,
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