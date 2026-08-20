/**
 * Admin Seeder - Creates initial admin user in the local PostgreSQL database.
 *
 * Usage:
 *   node seed-admin.js                       # uses defaults
 *   node seed-admin.js --email=X --password=Y --staff-id=Z
 *
 * Defaults:
 *   email:    admin@eftech.com.my
 *   password: Admin@123!
 *   staff-id: E0001
 */

import pg from "pg";
import bcrypt from "bcryptjs";

const { Pool } = pg;

const pool = new Pool({
  host: "127.0.0.1",
  port: 5434,
  database: "myleave",
  user: "myleave",
  password: "myleave123",
});

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (const arg of args) {
    if (arg.startsWith("--email="))    opts.email    = arg.split("=")[1];
    if (arg.startsWith("--password=")) opts.password = arg.split("=")[1];
    if (arg.startsWith("--staff-id=")) opts.staffId  = arg.split("=")[1];
    if (arg === "--help") {
      console.log(`
Admin Seeder for MyLeave Enhancement

Options:
  --email=EMAIL       Admin email (default: admin@eftech.com.my)
  --password=PASS     Admin password (default: Admin@123!)
  --staff-id=ID       Staff ID (default: E0001)
  --help              Show this help

Examples:
  node seed-admin.js
  node seed-admin.js --email=admin2@eftech.com.my --password=Secret99 --staff-id=E0002
      `);
      process.exit(0);
    }
  }
  return opts;
}

async function seed() {
  const opts = parseArgs();

  const email    = opts.email    || "admin@eftech.com.my";
  const password = opts.password || "Admin@123!";
  const staffId  = opts.staffId  || "E0001";

  console.log("Connecting to local PostgreSQL...");
  await pool.query("SELECT 1");
  console.log("Connected.\n");

  // Check if admin already exists
  const existing = await pool.query(
    "SELECT staff_id, email, role FROM profiles WHERE LOWER(email) = LOWER($1)",
    [email]
  );

  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    console.log(`Admin already exists: ${row.email} (${row.staff_id}, role: ${row.role})`);
    console.log("Skipping seed.\n");
    await pool.end();
    process.exit(0);
  }

  // Hash the password
  const hashedPassword = await bcrypt.hash(password, 12);

  const now = new Date();
  const employmentDate = "2020-01-01";

  // Insert admin profile
  const insertQuery = `
    INSERT INTO profiles (
      staff_id, full_name, email, password, role,
      position, department, employment_date,
      leave_entitlement_annual_original, leave_entitlement_medical_original,
      leave_entitlement_annual, leave_entitlement_medical,
      carry_forward_original, carry_forward_balance,
      remaining_leave, photourl
    ) VALUES (
      $1, $2, $3, $4, 'Admin',
      'System Administrator', 'IT', $5,
      16, 22,
      16, 22,
      0, 0,
      16, '/uploads/default-avatar.png'
    )
    RETURNING id, staff_id, full_name, email, role
  `;

  const result = await pool.query(insertQuery, [
    staffId,
    "System Administrator",
    email,
    hashedPassword,
    employmentDate,
  ]);

  const admin = result.rows[0];

  // Seed standard leave entitlements for the admin
  const entitlements = [
    { type: "HOSP",   entitlement: 60 },
    { type: "MAT",    entitlement: 98 },
    { type: "PAT",    entitlement: 7  },
    { type: "COMP_A", entitlement: 3  },
    { type: "COMP_B", entitlement: 1  },
    { type: "MAR",    entitlement: 3  },
  ];

  const year = now.getFullYear();

  for (const ent of entitlements) {
    await pool.query(
      `INSERT INTO leave_entitlements (staff_id, leave_type, entitlement, balance, year)
       VALUES ($1, $2, $3, $3, $4)`,
      [staffId, ent.type, ent.entitlement, year]
    );
  }

  // Insert admin role override
  await pool.query(
    `INSERT INTO role_setting (email, role, updated_at)
     VALUES ($1, 'admin', NOW())
     ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role`,
    [email]
  );

  console.log("Admin user created successfully!\n");
  console.log("  Staff ID:   " + admin.staff_id);
  console.log("  Full Name:  " + admin.full_name);
  console.log("  Email:      " + admin.email);
  console.log("  Role:       " + admin.role);
  console.log("  Password:   " + password);
  console.log("\n  Leave Entitlements seeded: HOSP(60), MAT(98), PAT(7), COMP_A(3), COMP_B(1), MAR(3)");
  console.log("  Role override set in role_setting table.\n");

  await pool.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
