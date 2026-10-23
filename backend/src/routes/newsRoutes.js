import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import pool from "../db.js";
import { logAdminAction } from "../middleware/adminLogger.js";

const router = express.Router();

// ============================
//  MULTER SETUP (PNG only)
// ============================
const newsUploadDir = path.join("uploads", "news");
if (!fs.existsSync(newsUploadDir)) {
  fs.mkdirSync(newsUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, newsUploadDir),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}.png`;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "image/png") return cb(null, true);
    return cb(new Error("Only PNG images are allowed"));
  },
});

// ============================
//  HELPERS
// ============================

// Admin check considers both the live DB role and the role stored in the
// auth_token cookie, because role_setting can elevate a profile to admin
// without changing profiles.role.
function isAdmin(req) {
  const dbRole = String(req.user?.role || "").toLowerCase();
  let cookieRole = "";
  try {
    cookieRole = String(
      JSON.parse(req.cookies?.auth_token || "{}").role || ""
    ).toLowerCase();
  } catch (err) {
    cookieRole = "";
  }
  return dbRole === "admin" || cookieRole === "admin";
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  return next();
}

function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  if (!isAdmin(req)) {
    return res.status(403).json({ error: "Access denied" });
  }
  return next();
}

// Today in Malaysia, so the daily popup resets at MYT midnight.
function malaysiaToday() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
  });
}

function unlinkImage(imagePath) {
  if (!imagePath) return;
  try {
    const filename = path.basename(imagePath);
    const target = path.join(newsUploadDir, filename);
    if (fs.existsSync(target)) fs.unlinkSync(target);
  } catch (err) {
    console.error("Failed to remove news image:", err);
  }
}

// ============================
//  GET /api/news
//  List published news + unread count for the current user
// ============================
router.get("/", requireAuth, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;
    const staffId = req.user.staff_id;

    const result = await pool.query(
      `SELECT n.id,
              n.title,
              n.body,
              n.image_path,
              n.created_by,
              n.created_by_name,
              n.created_at,
              n.updated_at,
              (r.news_id IS NOT NULL) AS is_read,
              (SELECT COUNT(*)::int
                 FROM news_reads rr
                WHERE rr.news_id = n.id) AS read_count
         FROM news_items n
         LEFT JOIN news_reads r
                ON r.news_id = n.id AND r.staff_id = $1
        WHERE n.status = 'published'
        ORDER BY n.created_at DESC
        LIMIT $2 OFFSET $3`,
      [staffId, limit, offset]
    );

    const unread = await pool.query(
      `SELECT COUNT(*)::int AS unread_count
         FROM news_items n
        WHERE n.status = 'published'
          AND NOT EXISTS (
            SELECT 1 FROM news_reads r
             WHERE r.news_id = n.id AND r.staff_id = $1
          )`,
      [staffId]
    );

    return res.json({
      items: result.rows,
      unread_count: unread.rows[0]?.unread_count || 0,
    });
  } catch (err) {
    console.error("GET /api/news error:", err);
    return res.status(500).json({ error: "Failed to load news" });
  }
});

// ============================
//  GET /api/news/unread-count
// ============================
router.get("/unread-count", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS unread_count
         FROM news_items n
        WHERE n.status = 'published'
          AND NOT EXISTS (
            SELECT 1 FROM news_reads r
             WHERE r.news_id = n.id AND r.staff_id = $1
          )`,
      [req.user.staff_id]
    );
    return res.json({ unread_count: result.rows[0]?.unread_count || 0 });
  } catch (err) {
    console.error("GET /api/news/unread-count error:", err);
    return res.status(500).json({ error: "Failed to load unread count" });
  }
});

// ============================
//  GET /api/news/daily
//  Should the daily popup be shown? + the 3 latest news
//  Read-only: never mutates state on a GET
// ============================
router.get("/daily", requireAuth, async (req, res) => {
  try {
    const staffId = req.user.staff_id;

    const result = await pool.query(
      `SELECT n.id,
              n.title,
              n.body,
              n.image_path,
              n.created_by,
              n.created_by_name,
              n.created_at
         FROM news_items n
        WHERE n.status = 'published'
        ORDER BY n.created_at DESC
        LIMIT 3`
    );

    const state = await pool.query(
      "SELECT last_popup_date::text FROM news_user_state WHERE staff_id = $1",
      [staffId]
    );

    const lastPopup = state.rows[0]?.last_popup_date || null;
    const shouldShow = result.rows.length > 0 && lastPopup !== malaysiaToday();

    return res.json({
      shouldShow,
      items: result.rows,
    });
  } catch (err) {
    console.error("GET /api/news/daily error:", err);
    return res.status(500).json({ error: "Failed to load daily news" });
  }
});

// ============================
//  POST /api/news/popup-seen
//  Called when the daily modal is actually rendered
// ============================
router.post("/popup-seen", requireAuth, async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO news_user_state (staff_id, last_popup_date)
            VALUES ($1, (CURRENT_DATE AT TIME ZONE 'Asia/Kuala_Lumpur')::date)
       ON CONFLICT (staff_id) DO UPDATE
              SET last_popup_date = (CURRENT_DATE AT TIME ZONE 'Asia/Kuala_Lumpur')::date`,
      [req.user.staff_id]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error("POST /api/news/popup-seen error:", err);
    return res.status(500).json({ error: "Failed to record popup" });
  }
});

// ============================
//  POST /api/news/:id/read
//  Mark a single news as read for the current user
// ============================
router.post("/:id/read", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid news id" });

    await pool.query(
      `INSERT INTO news_reads (news_id, staff_id)
            VALUES ($1, $2)
       ON CONFLICT (news_id, staff_id) DO NOTHING`,
      [id, req.user.staff_id]
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("POST /api/news/:id/read error:", err);
    return res.status(500).json({ error: "Failed to mark news as read" });
  }
});

// ============================
//  POST /api/news/read-all
//  Mark every published news as read for the current user
// ============================
router.post("/read-all", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `INSERT INTO news_reads (news_id, staff_id)
            SELECT n.id, $1
              FROM news_items n
             WHERE n.status = 'published'
       ON CONFLICT (news_id, staff_id) DO NOTHING`,
      [req.user.staff_id]
    );
    return res.json({ success: true, marked: result.rowCount || 0 });
  } catch (err) {
    console.error("POST /api/news/read-all error:", err);
    return res.status(500).json({ error: "Failed to mark all news as read" });
  }
});

// ============================
//  POST /api/news  (ADMIN)
//  Create a new bulletin post
// ============================
router.post("/", requireAdmin, upload.single("image"), async (req, res) => {
  try {
    const title = String(req.body?.title || "").trim();
    const body = String(req.body?.body || "").trim();

    if (!title || !body) {
      if (req.file) unlinkImage(`/uploads/news/${req.file.filename}`);
      return res.status(400).json({ error: "Title and body are required" });
    }

    const imagePath = req.file ? `/uploads/news/${req.file.filename}` : null;

    const result = await pool.query(
      `INSERT INTO news_items (title, body, image_path, created_by, created_by_name)
            VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
      [title, body, imagePath, req.user.staff_id, req.user.full_name]
    );

    await logAdminAction(
      req,
      "Posted Bulletin",
      `Published bulletin: ${title}`
    );

    return res.status(201).json({ success: true, news: result.rows[0] });
  } catch (err) {
    console.error("POST /api/news error:", err);
    return res.status(500).json({ error: "Failed to publish bulletin" });
  }
});

// ============================
//  PUT /api/news/:id  (ADMIN)
//  Update an existing bulletin post
// ============================
router.put("/:id", requireAdmin, upload.single("image"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid news id" });

    const title = String(req.body?.title || "").trim();
    const body = String(req.body?.body || "").trim();
    const removeImage = String(req.body?.removeImage || "") === "true";

    if (!title || !body) {
      if (req.file) unlinkImage(`/uploads/news/${req.file.filename}`);
      return res.status(400).json({ error: "Title and body are required" });
    }

    const existing = await pool.query(
      "SELECT * FROM news_items WHERE id = $1",
      [id]
    );
    if (existing.rows.length === 0) {
      if (req.file) unlinkImage(`/uploads/news/${req.file.filename}`);
      return res.status(404).json({ error: "News not found" });
    }

    const previous = existing.rows[0];
    let imagePath = previous.image_path;

    if (req.file) {
      imagePath = `/uploads/news/${req.file.filename}`;
      unlinkImage(previous.image_path);
    } else if (removeImage && previous.image_path) {
      imagePath = null;
      unlinkImage(previous.image_path);
    }

    const result = await pool.query(
      `UPDATE news_items
          SET title = $1,
              body = $2,
              image_path = $3,
              updated_at = NOW()
        WHERE id = $4
     RETURNING *`,
      [title, body, imagePath, id]
    );

    await logAdminAction(
      req,
      "Updated Bulletin",
      `Updated bulletin #${id}: ${title}`
    );

    return res.json({ success: true, news: result.rows[0] });
  } catch (err) {
    console.error("PUT /api/news/:id error:", err);
    return res.status(500).json({ error: "Failed to update bulletin" });
  }
});

// ============================
//  DELETE /api/news/:id  (ADMIN)
// ============================
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid news id" });

    const result = await pool.query(
      "DELETE FROM news_items WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "News not found" });
    }

    unlinkImage(result.rows[0].image_path);

    await logAdminAction(
      req,
      "Deleted Bulletin",
      `Deleted bulletin #${id}: ${result.rows[0].title}`
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/news/:id error:", err);
    return res.status(500).json({ error: "Failed to delete bulletin" });
  }
});

// ============================
//  Upload error handler
//  Turns multer errors into friendly 400s instead of a generic 500
// ============================
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "Image must be 5MB or smaller"
        : `Upload failed: ${err.message}`;
    return res.status(400).json({ error: message });
  }
  if (err) {
    return res.status(400).json({ error: err.message || "Upload failed" });
  }
  return next();
});

export default router;
