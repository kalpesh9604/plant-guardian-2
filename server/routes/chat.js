const express = require("express");
const { GoogleGenAI } = require("@google/genai");
const { rateLimit } = require("express-rate-limit");
const db = require("../database/db");
const authenticateToken = require("../middleware/authMiddleware");
const {
  buildSystemInstruction,
  toGeminiContents,
  getProviderErrorResponse
} = require("../services/plantChat");

const router = express.Router();
router.use(authenticateToken);

const chatMessageLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: req => String(req.user.id),
  message: { message: "Too many chat messages. Please wait a moment and try again." }
});

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function getOwnedSession(sessionId, userId) {
  return db.prepare(`
    SELECT s.id, s.user_id, s.plant_id, s.title, s.created_at,
           s.updated_at, p.name AS plant_name
    FROM ai_chat_sessions AS s
    LEFT JOIN plants AS p
      ON p.id = s.plant_id AND p.user_id = s.user_id
    WHERE s.id = ? AND s.user_id = ?
  `).get(sessionId, userId);
}

function getSessionMessages(sessionId, userId) {
  return db.prepare(`
    SELECT id, role, content, created_at
    FROM (
      SELECT id, role, content, created_at
      FROM ai_chat_messages
      WHERE session_id = ? AND user_id = ?
      ORDER BY id DESC
      LIMIT 100
    )
    ORDER BY id ASC
  `).all(sessionId, userId);
}

router.get("/sessions", (req, res) => {
  const sessions = db.prepare(`
    SELECT s.id, s.plant_id, s.title, s.created_at, s.updated_at,
           p.name AS plant_name
    FROM ai_chat_sessions AS s
    LEFT JOIN plants AS p
      ON p.id = s.plant_id AND p.user_id = s.user_id
    WHERE s.user_id = ?
    ORDER BY s.updated_at DESC, s.id DESC
    LIMIT 100
  `).all(req.user.id);

  res.json({ sessions });
});

router.post("/sessions", (req, res) => {
  const plantId = req.body?.plant_id ?? null;
  if (plantId !== null && (!Number.isInteger(plantId) || plantId < 1)) {
    return res.status(400).json({ message: "Invalid plant ID." });
  }

  if (plantId !== null) {
    const plant = db.prepare(`
      SELECT id FROM plants WHERE id = ? AND user_id = ?
    `).get(plantId, req.user.id);
    if (!plant) {
      return res.status(404).json({ message: "Plant not found." });
    }
  }

  const result = db.prepare(`
    INSERT INTO ai_chat_sessions (user_id, plant_id)
    VALUES (?, ?)
  `).run(req.user.id, plantId);

  const session = db.prepare(`
    SELECT s.id, s.plant_id, s.title, s.created_at, s.updated_at,
           p.name AS plant_name
    FROM ai_chat_sessions AS s
    LEFT JOIN plants AS p
      ON p.id = s.plant_id AND p.user_id = s.user_id
    WHERE s.id = ? AND s.user_id = ?
  `).get(result.lastInsertRowid, req.user.id);

  return res.status(201).json({ session });
});

router.get("/sessions/:sessionId/messages", (req, res) => {
  const sessionId = parseId(req.params.sessionId);
  if (!sessionId) {
    return res.status(400).json({ message: "Invalid chat session ID." });
  }

  if (!getOwnedSession(sessionId, req.user.id)) {
    return res.status(404).json({ message: "Chat session not found." });
  }

  res.json({ messages: getSessionMessages(sessionId, req.user.id) });
});

router.post("/sessions/:sessionId/messages", chatMessageLimiter, async (req, res) => {
  const sessionId = parseId(req.params.sessionId);
  if (!sessionId) {
    return res.status(400).json({ message: "Invalid chat session ID." });
  }

  const message = req.body?.message;
  if (
    typeof message !== "string" ||
    !message.trim() ||
    message.trim().length > 2000
  ) {
    return res.status(400).json({
      message: "Message must contain 1 to 2000 characters."
    });
  }

  const session = getOwnedSession(sessionId, req.user.id);
  if (!session) {
    return res.status(404).json({ message: "Chat session not found." });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({
      message: "The AI assistant is not configured. Add GEMINI_API_KEY to the server environment."
    });
  }

  const plant = session.plant_id
    ? db.prepare(`
        SELECT id, name, species, location, sunlight_preference,
               watering_interval_days, last_watered_at
        FROM plants
        WHERE id = ? AND user_id = ?
      `).get(session.plant_id, req.user.id)
    : null;

  const careRecords = plant
    ? db.prepare(`
        SELECT action_type, observation, notes, created_at
        FROM care_logs
        WHERE plant_id = ? AND user_id = ?
        ORDER BY created_at DESC
        LIMIT 5
      `).all(plant.id, req.user.id)
    : [];
  const history = db.prepare(`
    SELECT role, content
    FROM ai_chat_messages
    WHERE session_id = ? AND user_id = ?
    ORDER BY id DESC
    LIMIT 20
  `).all(sessionId, req.user.id).reverse();

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: { timeout: 30000 }
  });
  const model = process.env.GEMINI_CHAT_MODEL ||
    process.env.GEMINI_IMAGE_MODEL ||
    "gemini-3.1-flash-lite";

  let reply;
  try {
    const response = await ai.models.generateContent({
      model,
      contents: toGeminiContents([
        ...history,
        { role: "user", content: message.trim() }
      ]),
      config: {
        systemInstruction: buildSystemInstruction(plant, careRecords),
        maxOutputTokens: 700,
        temperature: 0.4
      }
    });
    reply = response.text?.trim();
  } catch (error) {
    const providerError = getProviderErrorResponse(error);
    console.error("AI chat provider request failed:", providerError.status);
    return res.status(providerError.status).json({
      message: providerError.message
    });
  }

  if (!reply) {
    return res.status(502).json({
      message: "Gemini returned an empty response. Please try again."
    });
  }

  const saveMessages = db.transaction(() => {
    db.prepare(`
      INSERT INTO ai_chat_messages (session_id, user_id, role, content)
      VALUES (?, ?, 'user', ?), (?, ?, 'assistant', ?)
    `).run(
      sessionId, req.user.id, message.trim(),
      sessionId, req.user.id, reply
    );

    const title = message.trim().replace(/\s+/g, " ").slice(0, 60);
    db.prepare(`
      UPDATE ai_chat_sessions
      SET title = CASE WHEN title = 'New chat' THEN ? ELSE title END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(title, sessionId, req.user.id);
  });
  saveMessages();

  const messages = getSessionMessages(sessionId, req.user.id);
  const updatedSession = getOwnedSession(sessionId, req.user.id);
  return res.json({ session: updatedSession, messages });
});

router.delete("/sessions/:sessionId", (req, res) => {
  const sessionId = parseId(req.params.sessionId);
  if (!sessionId) {
    return res.status(400).json({ message: "Invalid chat session ID." });
  }

  const result = db.prepare(`
    DELETE FROM ai_chat_sessions
    WHERE id = ? AND user_id = ?
  `).run(sessionId, req.user.id);

  if (result.changes === 0) {
    return res.status(404).json({ message: "Chat session not found." });
  }

  return res.json({ message: "Chat session deleted." });
});

module.exports = router;
