
const express = require("express");
const db = require("../database/db");
const authenticateToken = require("../middleware/authMiddleware");

const router = express.Router();

function parsePlantId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function isOptionalText(value, maxLength) {
  return value == null || (
    typeof value === "string" &&
    value.trim().length <= maxLength
  );
}

// Protect every route in this file
router.use(authenticateToken);

// GET ALL PLANTS
router.get("/", (req, res) => {
  const plants = db.prepare(`
    SELECT * FROM plants
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(req.user.id);

  res.json({ plants });
});

// ADD A PLANT
router.post("/", (req, res) => {
  const {
    name,
    species,
    location,
    sunlight_preference,
    watering_interval_days,
    notes
  } = req.body || {};

  if (typeof name !== "string" || !name.trim() || name.trim().length > 120) {
    return res.status(400).json({
      message: "Plant name is required and must be 120 characters or fewer."
    });
  }

  const interval = watering_interval_days ?? 7;

  if (!Number.isInteger(interval) || interval < 1 || interval > 365) {
    return res.status(400).json({
      message: "Watering interval must be between 1 and 365 days."
    });
  }

  if (
    !isOptionalText(species, 120) ||
    !isOptionalText(location, 120) ||
    !isOptionalText(sunlight_preference, 120) ||
    !isOptionalText(notes, 2000)
  ) {
    return res.status(400).json({
      message: "Plant details must be text within the allowed length."
    });
  }

  const result = db.prepare(`
    INSERT INTO plants (
      user_id, name, species, location,
      sunlight_preference, watering_interval_days, notes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.user.id,
    name.trim(),
    species || null,
    location || null,
    sunlight_preference || null,
    interval,
    notes || null
  );

  const plant = db.prepare(`
    SELECT * FROM plants
    WHERE id = ? AND user_id = ?
  `).get(result.lastInsertRowid, req.user.id);

  res.status(201).json({
    message: "Plant added successfully!",
    plant
  });
});

// GET ONE PLANT
router.get("/:id", (req, res) => {
  const plantId = parsePlantId(req.params.id);
  if (!plantId) {
    return res.status(400).json({ message: "Invalid plant ID." });
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

  res.json({ plant });
});

// UPDATE A PLANT
router.put("/:id", (req, res) => {
  const plantId = parsePlantId(req.params.id);
  if (!plantId) {
    return res.status(400).json({ message: "Invalid plant ID." });
  }

  const existing = db.prepare(`
    SELECT * FROM plants
    WHERE id = ? AND user_id = ?
  `).get(plantId, req.user.id);

  if (!existing) {
    return res.status(404).json({
      message: "Plant not found."
    });
  }

  const {
    name,
    species,
    location,
    sunlight_preference,
    watering_interval_days,
    notes
  } = req.body || {};

  const updatedName = name ?? existing.name;
  const interval = watering_interval_days ?? existing.watering_interval_days;

  if (
    typeof updatedName !== "string" ||
    !updatedName.trim() ||
    updatedName.trim().length > 120
  ) {
    return res.status(400).json({
      message: "Plant name is required and must be 120 characters or fewer."
    });
  }

  if (!Number.isInteger(interval) || interval < 1 || interval > 365) {
    return res.status(400).json({
      message: "Watering interval must be between 1 and 365 days."
    });
  }

  if (
    !isOptionalText(species, 120) ||
    !isOptionalText(location, 120) ||
    !isOptionalText(sunlight_preference, 120) ||
    !isOptionalText(notes, 2000)
  ) {
    return res.status(400).json({
      message: "Plant details must be text within the allowed length."
    });
  }

  const updatedSpecies = species === undefined
    ? existing.species
    : species?.trim() || null;
  const updatedLocation = location === undefined
    ? existing.location
    : location?.trim() || null;
  const updatedSunlight = sunlight_preference === undefined
    ? existing.sunlight_preference
    : sunlight_preference?.trim() || null;
  const updatedNotes = notes === undefined
    ? existing.notes
    : notes?.trim() || null;

  db.prepare(`
    UPDATE plants
    SET name = ?, species = ?, location = ?,
        sunlight_preference = ?, watering_interval_days = ?, notes = ?
    WHERE id = ? AND user_id = ?
  `).run(
    updatedName.trim(),
    updatedSpecies,
    updatedLocation,
    updatedSunlight,
    interval,
    updatedNotes,
    plantId,
    req.user.id
  );

  const plant = db.prepare(`
    SELECT * FROM plants
    WHERE id = ? AND user_id = ?
  `).get(plantId, req.user.id);

  res.json({
    message: "Plant updated successfully!",
    plant
  });
});

// DELETE A PLANT
router.delete("/:id", (req, res) => {
  const plantId = parsePlantId(req.params.id);
  if (!plantId) {
    return res.status(400).json({ message: "Invalid plant ID." });
  }

  const result = db.prepare(`
    DELETE FROM plants
    WHERE id = ? AND user_id = ?
  `).run(plantId, req.user.id);

  if (result.changes === 0) {
    return res.status(404).json({
      message: "Plant not found."
    });
  }

  res.json({
    message: "Plant deleted successfully!"
  });
});

module.exports = router;
