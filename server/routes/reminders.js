
const express = require("express");
const db = require("../database/db");
const authenticateToken = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateToken);

function parseReminderId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// CREATE REMINDER
router.post("/", (req, res) => {
  const { plant_id, reminder_type, due_at } = req.body || {};

  const plantId = Number(plant_id);
  const allowedTypes = ["watering", "fertilizing", "pruning", "general"];

  if (!Number.isInteger(plantId) || plantId < 1) {
    return res.status(400).json({
      message: "Valid plant ID is required."
    });
  }

  if (!allowedTypes.includes(reminder_type)) {
    return res.status(400).json({
      message: "Invalid reminder type."
    });
  }

  if (typeof due_at !== "string" || !Number.isFinite(Date.parse(due_at))) {
    return res.status(400).json({
      message: "A valid due date is required."
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

  const result = db.prepare(`
    INSERT INTO reminders (
      plant_id, user_id, reminder_type, due_at
    )
    VALUES (?, ?, ?, ?)
  `).run(plantId, req.user.id, reminder_type, due_at);

  const reminder = db.prepare(`
    SELECT * FROM reminders
    WHERE id = ? AND user_id = ?
  `).get(result.lastInsertRowid, req.user.id);

  res.status(201).json({
    message: "Reminder created successfully!",
    reminder
  });
});

// GET ALL REMINDERS
router.get("/", (req, res) => {
  const reminders = db.prepare(`
    SELECT reminders.*, plants.name AS plant_name,
           CASE
             WHEN reminders.status = 'pending'
              AND datetime(reminders.due_at) < CURRENT_TIMESTAMP
             THEN 1 ELSE 0
           END AS is_overdue
    FROM reminders
    JOIN plants ON plants.id = reminders.plant_id
    WHERE reminders.user_id = ?
    ORDER BY reminders.due_at ASC
  `).all(req.user.id);

  res.json({ reminders });
});

// MARK REMINDER COMPLETED
router.patch("/:id/complete", (req, res) => {
  const reminderId = parseReminderId(req.params.id);
  if (!reminderId) {
    return res.status(400).json({ message: "Invalid reminder ID." });
  }

  const result = db.prepare(`
    UPDATE reminders
    SET status = 'completed'
    WHERE id = ? AND user_id = ?
  `).run(reminderId, req.user.id);

  if (result.changes === 0) {
    return res.status(404).json({
      message: "Reminder not found."
    });
  }

  res.json({
    message: "Reminder marked as completed!"
  });
});

// DELETE REMINDER
router.delete("/:id", (req, res) => {
  const reminderId = parseReminderId(req.params.id);
  if (!reminderId) {
    return res.status(400).json({ message: "Invalid reminder ID." });
  }

  const result = db.prepare(`
    DELETE FROM reminders
    WHERE id = ? AND user_id = ?
  `).run(reminderId, req.user.id);

  if (result.changes === 0) {
    return res.status(404).json({
      message: "Reminder not found."
    });
  }

  res.json({
    message: "Reminder deleted successfully!"
  });
});

module.exports = router;
