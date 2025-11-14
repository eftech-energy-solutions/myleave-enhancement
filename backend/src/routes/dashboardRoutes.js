import express from 'express';
import pool from '../db.js';

const router = express.Router();

// GET — Employee Overview (count by department)
router.get('/employee-overview', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT 
        department AS name,
        COUNT(*)::int AS count
      FROM profiles
      WHERE department IS NOT NULL
        AND department <> '' 
        AND termination_date IS NULL
      GROUP BY department
      ORDER BY department ASC
    `);

    // Buang department "Administrator"
    const filtered = rows.filter(r => r.name !== 'Administrator');

    res.json({ departments: filtered });

  } catch (err) {
    console.error("Employee overview error:", err);
    res.status(500).json({ error: "Failed to load employee overview" });
  }
});

export default router;
