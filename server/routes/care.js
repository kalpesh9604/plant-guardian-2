
const express = require("express");
const db = require("../database/db");
const authenticateToken = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateToken);

// ADD CARE RECORD
router.post("/:plantId", (req, res) => {
  const { action_type, observation, notes } = req.body || {};
  const plantId = Number(req.params.plantId);

  const allowedActions = [
    "watering",
    "fertilizing",
    "pruning",
    "repotting",
    "observation"
  ];

  if (!Number.isInteger(plantId) || plantId < 1) {
    return res.status(400).json({ message: "Invalid plant ID." });
  }

  if (!allowedActions.includes(action_type)) {
    return res.status(400).json({
      message: "Invalid care action."
    });
  }

  if (
    (observation != null && typeof observation !== "string") ||
    (notes != null && typeof notes !== "string") ||
    observation?.length > 500 ||
    notes?.length > 2000
  ) {
    return res.status(400).json({
      message: "Observation and notes must be text within the allowed length."
    });
  }

  const plant = db.prepare(`
    SELECT id FROM plants
    WHERE id = ? AND user_id = ?
  `).get(plantId, req.user.id);

  if (!plant) {
    return res.status(404).json({
      message: "Plant not found."
    });
  }

  const saveCareRecord = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO care_logs (
        plant_id, user_id, action_type, observation, notes
      )
      VALUES (?, ?, ?, ?, ?)
    `).run(
      plantId,
      req.user.id,
      action_type,
      observation?.trim() || null,
      notes?.trim() || null
    );

    if (action_type === "watering") {
      db.prepare(`
        UPDATE plants
        SET last_watered_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `).run(plantId, req.user.id);
    }

    return result;
  });

  const result = saveCareRecord();

  const record = db.prepare(`
    SELECT * FROM care_logs
    WHERE id = ? AND user_id = ?
  `).get(result.lastInsertRowid, req.user.id);

  res.status(201).json({
    message: "Care record added successfully!",
    record
  });
});

// GET CARE HISTORY
router.get("/:plantId", (req, res) => {
  const plantId = Number(req.params.plantId);

  if (!Number.isInteger(plantId) || plantId < 1) {
    return res.status(400).json({ message: "Invalid plant ID." });
  }

  const plant = db.prepare(`
    SELECT id FROM plants
    WHERE id = ? AND user_id = ?
  `).get(plantId, req.user.id);

  if (!plant) {
    return res.status(404).json({
      message: "Plant not found."
    });
  }

  const records = db.prepare(`
    SELECT * FROM care_logs
    WHERE plant_id = ? AND user_id = ?
    ORDER BY created_at DESC
  `).all(plantId, req.user.id);

  res.json({ records });
});

module.exports = router;

