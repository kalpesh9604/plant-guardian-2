
const express = require("express");
const db = require("../database/db");
const authenticateToken = require("../middleware/authMiddleware");
const { analyzePlant } = require("../services/plantAI");

const router = express.Router();

router.use(authenticateToken);

// ANALYZE A PLANT
router.post("/:plantId/analyze", (req, res) => {
  const plantId = Number(req.params.plantId);

  if (!Number.isInteger(plantId) || plantId < 1) {
    return res.status(400).json({
      message: "Invalid plant ID."
    });
  }

  const plant = db.prepare(`
    SELECT * FROM plants
    WHERE id = ? AND user_id = ?
  `).get(plantId, req.user.id);

  if (!plant) {
    return res.status(404).json({
      message: "Plant not found."
    });
  }

  const symptoms = req.body?.symptoms || [];

  if (
    !Array.isArray(symptoms) ||
    symptoms.length > 20 ||
    !symptoms.every(item => typeof item === "string" && item.length <= 100)
  ) {
    return res.status(400).json({
      message: "Symptoms must be an array of text values."
    });
  }

  const analysis = analyzePlant(plant, symptoms);

  // SAVE RECOMMENDATIONS
  const saveRecommendation = db.prepare(`
    INSERT INTO ai_recommendations (
      plant_id, user_id, category, recommendation
    )
    VALUES (?, ?, ?, ?)
  `);

  const saveMany = db.transaction((recommendations) => {
    for (const item of recommendations) {
      saveRecommendation.run(
        plantId,
        req.user.id,
        item.category,
        item.message
      );
    }
  });

  saveMany(analysis.recommendations);

  res.json({
    message: "Plant analysis completed!",
    plant: {
      id: plant.id,
      name: plant.name,
      species: plant.species
    },
    analysis,
    analysisType: "Rule-based plant care assessment"
  });
});

// GET SAVED AI RECOMMENDATIONS
router.get("/:plantId/recommendations", (req, res) => {
  const plantId = Number(req.params.plantId);

  const plant = db.prepare(`
    SELECT id FROM plants
    WHERE id = ? AND user_id = ?
  `).get(plantId, req.user.id);

  if (!plant) {
    return res.status(404).json({
      message: "Plant not found."
    });
  }

  const recommendations = db.prepare(`
    SELECT * FROM ai_recommendations
    WHERE plant_id = ? AND user_id = ?
    ORDER BY created_at DESC
  `).all(plantId, req.user.id);

  res.json({ recommendations });
});

module.exports = router;
