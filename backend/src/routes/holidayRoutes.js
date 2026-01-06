import express from "express";
import pool from "../db.js";
import { fetchMalaysiaHolidays } from "../utils/fetchMalaysiaHolidays.js";
import { recalculateAffectedLeaves, checkHolidayImpact } from "../utils/holidayImpactHandler.js";
import { logAdminAction } from '../middleware/adminLogger.js';

console.log('✅ holidayImpactHandler imported:', {
  recalculateAffectedLeaves: typeof recalculateAffectedLeaves,
  checkHolidayImpact: typeof checkHolidayImpact
});

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
    console.log("🔥 POST /api/holidays triggered");
    console.log("POST /api/holidays body:", req.body);

    let { date, title, description } = req.body || {};

    // Normalize
    date = (date || "").trim();
    title = (title || "").trim();
    description = (description ?? "").trim();

    if (!date || !title) {
      return res.status(400).json({ error: "Date and title required" });
    }

    // Basic YYYY-MM-DD format check
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "Date must be YYYY-MM-DD" });
    }

    await pool.query(
      "INSERT INTO public_holidays (date, title, description) VALUES ($1,$2,$3)",
      [date, title, description || null]
    );

    // 🔥 NEW: Recalculate affected leaves
    const impact = await recalculateAffectedLeaves(date);
    console.log(`✅ Holiday added. Recalculated ${impact.affectedCount} leave(s)`);
    await logAdminAction(
          req, 
          'Added Holiday', 
          `Added public holiday: ${title} on ${date}`
        );
    res.json({ 
      success: true,
      message: impact.affectedCount > 0 
        ? `Holiday added. ${impact.affectedCount} approved leave(s) were recalculated.`
        : "Holiday added successfully.",
      impact: impact
    });
  } catch (e) {
    console.error("POST /api/holidays error:", e);
    res.status(500).json({ error: "Failed to add holiday" });
  }
});

// 🟢 DELETE — remove custom holiday WITH RECALCULATION
router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "Missing or invalid holiday id" });

    // Get the date before deleting
    const { rows: holidayRows } = await pool.query(
      "SELECT date::text FROM public_holidays WHERE id=$1", 
      [id]
    );

    if (holidayRows.length === 0) {
      return res.status(404).json({ error: "Holiday not found" });
    }

    const holidayDate = holidayRows[0].date;

    // Check impact (optional - just for logging)
    const impact = await checkHolidayImpact(holidayDate);
    
    if (impact.hasImpact) {
      console.log(`⚠️ Warning: Deleting holiday will affect ${impact.affectedCount} approved leave(s)`);
    }

    // Delete the holiday
    const result = await pool.query("DELETE FROM public_holidays WHERE id=$1 RETURNING *", [id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Holiday not found" });
    }

    // Recalculate affected leaves
    const recalcResult = await recalculateAffectedLeaves(holidayDate);
    console.log(`✅ Holiday deleted. Recalculated ${recalcResult.affectedCount} leave(s)`);
    await logAdminAction(
          req, 
          'Deleted Holiday', 
          `Deleted public holiday on ${holidayDate}`
        );
    res.json({ 
      success: true,
      message: recalcResult.affectedCount > 0
        ? `Holiday deleted. ${recalcResult.affectedCount} approved leave(s) were recalculated.`
        : "Holiday deleted successfully.",
      impact: recalcResult
    });
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

    // Get old date before updating
    const { rows: oldHoliday } = await pool.query(
      "SELECT date::text FROM public_holidays WHERE id=$1",
      [id]
    );

    if (oldHoliday.length === 0) {
      return res.status(404).json({ error: "Holiday not found" });
    }

    const oldDate = oldHoliday[0].date;

    const result = await pool.query(
      "UPDATE public_holidays SET date=$1, title=$2, description=$3 WHERE id=$4 RETURNING *",
      [date, title, description || null, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Holiday not found" });
    }

    // 🔥 NEW: Recalculate for both old and new dates
    let totalAffected = 0;
    
    if (oldDate !== date) {
      // Date changed - recalculate both dates
      const oldImpact = await recalculateAffectedLeaves(oldDate);
      const newImpact = await recalculateAffectedLeaves(date);
      totalAffected = oldImpact.affectedCount + newImpact.affectedCount;
      console.log(`✅ Holiday updated. Recalculated ${totalAffected} leave(s) total`);
    } else {
      // Only title/description changed - no recalculation needed
      console.log(`✅ Holiday updated (date unchanged - no recalculation needed)`);
    }

    res.json({ 
      success: true, 
      updated: result.rows[0],
      message: totalAffected > 0
        ? `Holiday updated. ${totalAffected} approved leave(s) were recalculated.`
        : "Holiday updated successfully."
    });
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

    // Recalculate affected leaves (hiding = more working days = more deduction)
    const impact = await recalculateAffectedLeaves(date);
    console.log(`✅ Holiday hidden. Recalculated ${impact.affectedCount} leave(s)`);

    res.json({ 
      success: true,
      message: impact.affectedCount > 0
        ? `Holiday hidden. ${impact.affectedCount} approved leave(s) were recalculated.`
        : "Holiday hidden successfully.",
      impact: impact
    });
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

    // Recalculate affected leaves (unhiding = less working days = less deduction)
    const impact = await recalculateAffectedLeaves(date);
    console.log(`✅ Holiday unhidden. Recalculated ${impact.affectedCount} leave(s)`);

    res.json({ 
      success: true,
      message: impact.affectedCount > 0
        ? `Holiday unhidden. ${impact.affectedCount} approved leave(s) were recalculated.`
        : "Holiday unhidden successfully.",
      impact: impact
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to unhide official holiday" });
  }
});

// 🟢 GET — Check impact before deletion (optional endpoint for frontend warning)
router.get("/impact/:date", async (req, res) => {
  try {
    const date = req.params.date;
    
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
    }

    const impact = await checkHolidayImpact(date);
    
    res.json(impact);
  } catch (e) {
    console.error("GET /api/holidays/impact/:date error:", e);
    res.status(500).json({ error: "Failed to check impact" });
  }
});

export default router;