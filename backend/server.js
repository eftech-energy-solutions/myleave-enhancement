import express from 'express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import pool from './src/db.js';
import cors from 'cors';

const app = express();

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));

app.use(bodyParser.json());
app.use(cookieParser());

// ✅ Test route
app.get('/', (req, res) => {
  res.send('✅ Backend is running');
});

// ✅ LOGIN API
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  console.log('DEBUG LOGIN:', email, password);

  try {
    const result = await pool.query(
      'SELECT staff_id, full_name, email, password, role FROM profiles WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    if (user.password !== password) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    let redirectTo = '/dashboard/staff';
    if (user.role === 'admin') redirectTo = '/dashboard/admin/main';
    else if (user.role === 'manager') redirectTo = '/dashboard/manager';

      res.cookie(
      'auth_token',
      JSON.stringify({
        email: user.email,
        name: user.full_name,
        staffId: user.staff_id,
        role: user.role
      }),
      {
        httpOnly: false, // true kalau production
        secure: false,   // true kalau HTTPS
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000, // 1 hari
        path: '/'
      }
    );

    res.json({
      success: true,
      redirectTo,
      email: user.email,
      name: user.full_name,
      staffId: user.staff_id,
      role: user.role
    });
  } catch (err) {
    console.error('DB error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ✅ NEW: Get user from cookie
app.get('/api/me', (req, res) => {console.log('🍪 Cookies received at /api/me:', req.cookies);
  const token = req.cookies['auth_token'];

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const user = JSON.parse(token);
    res.json(user);
  } catch (err) {
    console.error('Invalid cookie:', err);
    res.status(400).json({ error: 'Invalid cookie' });
  }
});

app.listen(5000, () => {
  console.log('✅ Backend running on http://localhost:5000');
});
