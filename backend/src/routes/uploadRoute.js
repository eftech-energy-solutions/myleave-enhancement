import express from "express";
import multer from "multer";
import path from "path";
import pool from "../db.js"; // your PostgreSQL pool

const router = express.Router();

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + path.extname(file.originalname);
    cb(null, uniqueName);
  },
});
const upload = multer({ storage });

// -------- Admin adds new employee (unchanged) --------
router.post("/", upload.single("photo"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  res.json({ filePath: `/uploads/${req.file.filename}` });
});

// -------- Employee updates own profile photo --------
router.post("/profile", upload.single("photo"), async (req, res) => {
  try {
    const token = req.cookies["auth_token"];
    if (!token) return res.status(401).json({ error: "Not authenticated" });

    const user = JSON.parse(token);
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const photourl = `/uploads/${req.file.filename}`;

    // Update DB
    await pool.query(
      "UPDATE profiles SET photourl = $1 WHERE staff_id = $2",
      [photourl, user.staffId]
    );

    res.json({ success: true, photoUrl: photourl });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Failed to upload photo" });
  }
});

export default router;
