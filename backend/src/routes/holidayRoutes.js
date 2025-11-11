import express from "express";
import pool from "../db.js";
import { fetchMalaysiaHolidays } from "../utils/fetchMalaysiaHolidays.js";

const router = express.Router();

// 🟢 GET — combine official (minus hidden) + custom
router.get("/", async (req, res) => {
  try {
    const official = await fetchMalaysiaHolidays();

    // get hidden official holidays
    const { rows: hidden } = await pool.query(
      "SELECT uid, date::text FROM holiday_overrides WHERE action='hide'"
    );
    const hiddenSet = new Set(hidden.map((h) => `${h.uid}|${h.date}`));
    const visibleOfficial = official.filter(
      (h) => !hiddenSet.has(`${h.uid}|${h.date}`)
    );

    // get custom holidays
    const { rows: custom } = await pool.query(
      "SELECT id, date::text, title, description FROM public_holidays ORDER BY date"
    );
    const formattedCustom = custom.map((h) => ({
      ...h,
      source: "custom",
    }));

    const combined = [...visibleOfficial, ...formattedCustom].sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    res.json(combined);
  } catch (e) {
    console.error("Error fetching holidays:", e);
    res.status(500).json({ error: "Failed to fetch holidays" });
  }
});

// 🟢 POST — add new custom holiday
router.post("/", async (req, res) => {
  try {
    // Debug: see exactly what the client sent
    console.log("POST /api/holidays body:", req.body);

    let { date, title, description } = req.body || {};

    // Normalize (avoid whitespace-only)
    date = (date || "").trim();
    title = (title || "").trim();
    description = (description ?? "").trim();

    if (!date || !title) {
      return res.status(400).json({ error: "Date and title required" });
    }

    // Basic YYYY-MM-DD format check (prevents accidental local format)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "Date must be YYYY-MM-DD" });
    }

    await pool.query(
      "INSERT INTO public_holidays (date, title, description) VALUES ($1,$2,$3)",
      [date, title, description || null]
    );

    res.json({ success: true });
  } catch (e) {
    console.error("POST /api/holidays error:", e);
    res.status(500).json({ error: "Failed to add holiday" });
  }
});

// 🟢 DELETE — remove custom holiday
router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "Missing or invalid holiday id" });

    const result = await pool.query("DELETE FROM public_holidays WHERE id=$1", [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Holiday id not found" });
    }

    res.json({ success: true });
  } catch (e) {
    console.error("DELETE /api/holidays/:id error:", e);
    res.status(500).json({ error: "Failed to delete holiday" });
  }
});

// 🟢 PUT — update existing custom holiday
router.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { date, title, description } = req.body;

    if (!id || !date || !title) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const result = await pool.query(
      "UPDATE public_holidays SET date=$1, title=$2, description=$3 WHERE id=$4 RETURNING *",
      [date, title, description || null, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Holiday not found" });
    }

    res.json({ success: true, updated: result.rows[0] });
  } catch (e) {
    console.error("PUT /api/holidays/:id error:", e);
    res.status(500).json({ error: "Failed to update holiday" });
  }
});

// 🟢 POST — hide official holiday
router.post("/official/hide", async (req, res) => {
  try {
    const { uid, date, reason } = req.body;
    if (!uid || !date)
      return res.status(400).json({ error: "uid and date required" });

    await pool.query(
      "INSERT INTO holiday_overrides (uid, date, action, reason) VALUES ($1,$2,'hide',$3) ON CONFLICT (uid,date) DO UPDATE SET action='hide', reason=EXCLUDED.reason",
      [uid, date, reason || null]
    );

    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to hide official holiday" });
  }
});

// 🟢 POST — unhide official holiday
router.post("/official/unhide", async (req, res) => {
  try {
    const { uid, date } = req.body;
    if (!uid || !date)
      return res.status(400).json({ error: "uid and date required" });
    await pool.query("DELETE FROM holiday_overrides WHERE uid=$1 AND date=$2", [
      uid,
      date,
    ]);
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to unhide official holiday" });
  }
});

export default router;
