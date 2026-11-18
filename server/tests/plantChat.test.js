const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildSystemInstruction,
  toGeminiContents,
  getProviderErrorResponse
} = require("../services/plantChat");

test("builds personalized context only from the selected plant data", () => {
  const instruction = buildSystemInstruction({
    name: "Fern",
    species: "Boston fern",
    location: "Indoor",
    sunlight_preference: "Indirect light",
    watering_interval_days: 5,
    last_watered_at: "2026-11-17"
  }, [{
    action_type: "watering",
    observation: "Soil was dry",
    notes: null,
    created_at: "2026-11-17"
  }]);

  assert.match(instruction, /Boston fern/);
  assert.match(instruction, /Soil was dry/);
  assert.match(instruction, /Do not claim to diagnose disease with certainty/);
});

test("maps persisted chat roles to Gemini conversation roles", () => {
  assert.deepEqual(toGeminiContents([
    { role: "user", content: "Why are leaves yellow?" },
    { role: "assistant", content: "Check soil moisture first." }
  ]), [
    { role: "user", parts: [{ text: "Why are leaves yellow?" }] },
    { role: "model", parts: [{ text: "Check soil moisture first." }] }
  ]);
});

test("returns specific, user-safe errors for Gemini failures", () => {
  assert.equal(getProviderErrorResponse({ status: 429 }).status, 429);
  assert.equal(getProviderErrorResponse({ error: { code: 503 } }).status, 503);
  assert.equal(getProviderErrorResponse({ status: 404 }).status, 503);
  assert.equal(getProviderErrorResponse(new Error("network error")).status, 502);
});
