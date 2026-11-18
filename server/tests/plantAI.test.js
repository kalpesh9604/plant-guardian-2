const test = require("node:test");
const assert = require("node:assert/strict");
const { analyzePlant } = require("../services/plantAI");

const healthyPlant = {
  name: "Test plant",
  last_watered_at: new Date().toISOString(),
  watering_interval_days: 7,
  sunlight_preference: "Indirect light"
};

test("reports a baseline estimate from current care information", () => {
  const result = analyzePlant(healthyPlant);

  assert.equal(result.healthScore, 100);
  assert.equal(result.healthStatus, "Excellent");
  assert.equal(result.recommendations.length, 1);
  assert.equal(result.recommendations[0].category, "general");
});

test("does not penalize duplicate symptoms more than once", () => {
  const once = analyzePlant(healthyPlant, ["yellow leaves"]);
  const repeated = analyzePlant(healthyPlant, ["yellow leaves", "yellow leaves"]);

  assert.equal(repeated.healthScore, once.healthScore);
  assert.equal(repeated.recommendations.filter(item => item.category === "disease").length, 1);
});

test("lowers the estimate when watering is overdue", () => {
  const plant = {
    ...healthyPlant,
    last_watered_at: "2000-01-01 00:00:00",
    watering_interval_days: 7
  };
  const result = analyzePlant(plant);

  assert.equal(result.healthScore, 80);
  assert.equal(result.recommendations[0].priority, "high");
});

test("keeps health scores bounded when multiple symptoms are selected", () => {
  const result = analyzePlant(healthyPlant, [
    "yellow leaves", "brown tips", "wilting", "spots", "drooping leaves",
    "curling leaves", "white powder", "mold on soil", "pests", "root rot"
  ]);

  assert.ok(result.healthScore >= 0);
  assert.ok(result.healthScore <= 100);
});
