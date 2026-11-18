
const express = require("express");
const db = require("../database/db");
const authenticateToken = require("../middleware/authMiddleware");
const { analyzePlant } = require("../services/plantAI");

const router = express.Router();

router.use(authenticateToken);

// GET DASHBOARD STATISTICS
router.get("/stats", (req, res) => {
  const userId = req.user.id;

  const totalPlants = db.prepare(`
    SELECT COUNT(*) AS count
    FROM plants
    WHERE user_id = ?
  `).get(userId).count;

  const totalWaterings = db.prepare(`
    SELECT COUNT(*) AS count
    FROM care_logs
    WHERE user_id = ? AND action_type = 'watering'
  `).get(userId).count;

  const pendingReminders = db.prepare(`
    SELECT COUNT(*) AS count
    FROM reminders
    WHERE user_id = ? AND status = 'pending'
  `).get(userId).count;

  const completedReminders = db.prepare(`
    SELECT COUNT(*) AS count
    FROM reminders
    WHERE user_id = ? AND status = 'completed'
  `).get(userId).count;

  const recentActivities = db.prepare(`
    SELECT care_logs.*, plants.name AS plant_name
    FROM care_logs
    JOIN plants ON plants.id = care_logs.plant_id
    WHERE care_logs.user_id = ?
    ORDER BY care_logs.created_at DESC
    LIMIT 5
  `).all(userId);

  const wateringHistory = db.prepare(`
    SELECT date(created_at) AS date, COUNT(*) AS count
    FROM care_logs
    WHERE user_id = ?
      AND action_type = 'watering'
      AND date(created_at) >= date('now', '-6 days')
    GROUP BY date(created_at)
    ORDER BY date(created_at)
  `).all(userId);

  const plantHealth = db.prepare(`
    SELECT id, name, species, watering_interval_days,
           sunlight_preference, last_watered_at
    FROM plants
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(userId).map(plant => ({
    id: plant.id,
    name: plant.name,
    ...analyzePlant(plant)
  }));

  res.json({
    message: "Dashboard statistics retrieved successfully!",
    stats: {
      totalPlants,
      totalWaterings,
      pendingReminders,
      completedReminders,
      wateringHistory,
      plantHealth
    },
    recentActivities
  });
});

module.exports = router;
