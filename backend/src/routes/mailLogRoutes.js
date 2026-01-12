// backend/src/routes/mailLogRoutes.js
import express from "express";
import fs from "fs";
import path from "path";
import { requireSalesManager } from "../middleware/auth.js";

const router = express.Router();

const OUTBOX_DIR = path.resolve(process.cwd(), "outbox");

function safeReadJson(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * List outbox logs (Sales Manager only)
 * GET /api/mail-logs?type=discount|invoice|refund-approval&limit=50
 */
router.get("/", requireSalesManager, async (req, res) => {
  try {
    const { type, limit } = req.query || {};
    const lim = Math.min(Math.max(Number(limit) || 50, 1), 200);

    if (!fs.existsSync(OUTBOX_DIR)) return res.json([]);

    let files = fs
      .readdirSync(OUTBOX_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => ({
        file: f,
        fullPath: path.join(OUTBOX_DIR, f),
        mtime: fs.statSync(path.join(OUTBOX_DIR, f)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime);

    if (type) {
      const t = String(type).toLowerCase().trim();
      files = files.filter((x) => x.file.toLowerCase().startsWith(`${t}-`));
    }

    const picked = files.slice(0, lim).map((x) => {
      const data = safeReadJson(x.fullPath);
      return {
        file: x.file,
        at: data?.at || null,
        to: data?.to || null,
        subject: data?.subject || null,
        used: data?.used || null,
        orderId: data?.orderId || null,
        discountRate: data?.discountRate || null,
        returnId: data?.returnId || null,
      };
    });

    return res.json(picked);
  } catch (e) {
    console.error("MAIL LOG LIST ERROR:", e);
    return res.status(500).json({ message: "Mail logs fetch failed" });
  }
});

/**
 * Read one outbox log (Sales Manager only)
 * GET /api/mail-logs/:file
 */
router.get("/:file", requireSalesManager, async (req, res) => {
  try {
    const filename = String(req.params.file || "");
    if (!filename.endsWith(".json")) {
      return res.status(400).json({ message: "Invalid file" });
    }

    // path traversal koruması
    const fullPath = path.resolve(OUTBOX_DIR, filename);
    if (!fullPath.startsWith(OUTBOX_DIR)) {
      return res.status(400).json({ message: "Invalid path" });
    }

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ message: "Log not found" });
    }

    const data = safeReadJson(fullPath);
    if (!data) return res.status(500).json({ message: "Could not parse log" });

    return res.json({ file: filename, ...data });
  } catch (e) {
    console.error("MAIL LOG READ ERROR:", e);
    return res.status(500).json({ message: "Mail log read failed" });
  }
});

export default router;
