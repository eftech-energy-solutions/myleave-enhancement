import pool from '$lib/server/db.js';
import bcrypt from 'bcrypt';

// 🟢 Get all profiles
export async function getAllProfiles() {
  const { rows } = await pool.query('SELECT * FROM profiles ORDER BY created_at DESC');
  return rows;
}

// 🟢 Get one profile by email
export async function getProfileByEmail(email) {
  const { rows } = await pool.query('SELECT * FROM profiles WHERE email = $1 LIMIT 1', [email]);
  return rows[0];
}

// 🟢 Add new profile (for admin add employee)
export async function createProfile(data) {
  const {
    full_name, staff_id, role, dept, email, password,
    employment_date, confirmation_date, termination_date,
    gender, notes, leave_ent_annual, leave_ent_medical
  } = data;

  const password_hash = await bcrypt.hash(password, 10);

  const { rows } = await pool.query(
    `INSERT INTO profiles
    (full_name, staff_id, role, dept, email, employment_date, confirmation_date, termination_date,
     gender, notes, password_hash, leave_ent_annual, leave_ent_medical)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING *`,
    [
      full_name, staff_id, role, dept, email, employment_date, confirmation_date, termination_date,
      gender, notes, password_hash, leave_ent_annual, leave_ent_medical
    ]
  );

  return rows[0];
}

// 🟢 Login verification
export async function verifyLogin(email, password) {
  const user = await getProfileByEmail(email);
  if (!user) return null;
  const valid = await bcrypt.compare(password, user.password_hash);
  return valid ? user : null;
}
