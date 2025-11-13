import express from "express";
import multer from "multer";
import path from "path";
import pool from "../db.js"; // your PostgreSQL pool

const router = express.Router();

// =========================
//  Multer Setup (Uploads)
// =========================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + path.extname(file.originalname);
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

// ============================================================
// 1) ADMIN UPLOAD PHOTO (USED BY ADD NEW EMPLOYEE)
// ============================================================
router.post("/", upload.single("photo"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: "No file uploaded" });
  }

  // FIXED: Return photoUrl instead of filePath
  const photoUrl = `/uploads/${req.file.filename}`;

  return res.json({
    success: true,
    photoUrl: photoUrl
  });
});

// ============================================================
// 2) EMPLOYEE UPDATES OWN PROFILE PHOTO
// ============================================================
router.post("/profile", upload.single("photo"), async (req, res) => {
  try {
    const token = req.cookies["auth_token"];
    if (!token) return res.status(401).json({ error: "Not authenticated" });

    const user = JSON.parse(token);
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const photoUrl = `/uploads/${req.file.filename}`;

    // Update DB photourl column
    await pool.query(
      "UPDATE profiles SET photourl = $1 WHERE staff_id = $2",
      [photoUrl, user.staffId]
    );

    res.json({
      success: true,
      photoUrl: photoUrl
    });

  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Failed to upload photo" });
  }
});

export default router;
