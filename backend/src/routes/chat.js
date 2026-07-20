import express from 'express';
import pool from '../db.js';

const router = express.Router();

router.get('/users', async (req, res) => {
  try {
    const search = req.query.search?.trim() || '';

    const result = await pool.query(
      `
      SELECT
        staff_id,
        full_name,
        department,
        position,
        photourl
      FROM profiles
      WHERE
        termination_date IS NULL
        AND (
          full_name ILIKE $1
          OR staff_id ILIKE $1
          OR department ILIKE $1
        )
      ORDER BY full_name ASC
      LIMIT 50
      `,
      [`%${search}%`]
    );

    return res.json({
      success: true,
      users: result.rows
    });
  } catch (error) {
    console.error('Get chat users error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve chat users'
    });
  }
});

export default router;