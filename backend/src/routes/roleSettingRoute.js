import express from "express";
import pool from "../db.js";

const router = express.Router();

router.post("/role-setting", async (req, res) => {
    const { email, role } = req.body;

    if (!email || !role) {
        return res.status(400).json({
            error: "Email dan role diperlukan."
        });
    }

    try {
        const result = await pool.query(
            `INSERT INTO role_setting (email, role, updated_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT (email)
             DO UPDATE SET role = EXCLUDED.role, updated_at = NOW()
             RETURNING *;`,
            [email.toLowerCase(), role]
        );

        return res.json({
            message: "Role updated successfully",
            data: result.rows[0]
        });

    } catch (err) {
        console.error("Role setting DB error:", err);
        return res.status(500).json({
            error: "Server error (DB failed)"
        });
    }
});

router.get("/role-setting", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT email, role FROM role_setting ORDER BY role ASC`
        );

        return res.json({
            success: true,
            data: result.rows
        });
    } catch (err) {
        console.error("Role setting GET error:", err);
        return res.status(500).json({ success: false, error: "Server error" });
    }
});


export default router;
