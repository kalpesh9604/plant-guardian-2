const test = require("node:test");
const assert = require("node:assert/strict");

process.env.PLANT_GUARDIAN_DB_PATH = ":memory:";
process.env.JWT_SECRET = "test-only-secret-that-is-at-least-thirty-two-bytes";

const express = require("express");
const jwt = require("jsonwebtoken");
const db = require("../database/db");
require("../database/schema");
const chatRouter = require("../routes/chat");

const app = express();
app.use(express.json());
app.use("/api/ai/chat", chatRouter);

let server;
let baseUrl;
let ownerToken;
let otherToken;
let plantId;

test("chat sessions persist and remain isolated by authenticated user", async t => {
  const ownerId = db.prepare(`
    INSERT INTO users (name, email, password_hash)
    VALUES ('Owner', 'owner@example.test', 'test-hash')
  `).run().lastInsertRowid;
  const otherId = db.prepare(`
    INSERT INTO users (name, email, password_hash)
    VALUES ('Other', 'other@example.test', 'test-hash')
  `).run().lastInsertRowid;

  ownerToken = jwt.sign({ id: ownerId, email: "owner@example.test" }, process.env.JWT_SECRET);
  otherToken = jwt.sign({ id: otherId, email: "other@example.test" }, process.env.JWT_SECRET);

  plantId = db.prepare(`
    INSERT INTO plants (user_id, name, species)
    VALUES (?, 'Fern', 'Boston fern')
  `).run(ownerId).lastInsertRowid;

  await new Promise(resolve => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}/api/ai/chat`;

  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    db.close();
  });

  const unauthorized = await fetch(`${baseUrl}/sessions`);
  assert.equal(unauthorized.status, 401);

  const foreignPlant = await fetch(`${baseUrl}/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${otherToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ plant_id: plantId })
  });
  assert.equal(foreignPlant.status, 404);

  const createdResponse = await fetch(`${baseUrl}/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ownerToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ plant_id: plantId })
  });
  assert.equal(createdResponse.status, 201);
  const { session } = await createdResponse.json();
  assert.equal(session.plant_id, plantId);

  const otherSessions = await fetch(`${baseUrl}/sessions`, {
    headers: { Authorization: `Bearer ${otherToken}` }
  });
  assert.deepEqual((await otherSessions.json()).sessions, []);

  const otherMessages = await fetch(
    `${baseUrl}/sessions/${session.id}/messages`,
    { headers: { Authorization: `Bearer ${otherToken}` } }
  );
  assert.equal(otherMessages.status, 404);

  const invalidMessage = await fetch(
    `${baseUrl}/sessions/${session.id}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message: "   " })
    }
  );
  assert.equal(invalidMessage.status, 400);

  const previousKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  const unconfigured = await fetch(
    `${baseUrl}/sessions/${session.id}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message: "How is my fern?" })
    }
  );
  if (previousKey !== undefined) process.env.GEMINI_API_KEY = previousKey;
  assert.equal(unconfigured.status, 503);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const response = await fetch(
      `${baseUrl}/sessions/${session.id}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ownerToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ message: "   " })
      }
    );
    assert.equal(response.status, 400);
  }
  const rateLimited = await fetch(
    `${baseUrl}/sessions/${session.id}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message: "Another question" })
    }
  );
  assert.equal(rateLimited.status, 429);

  const ownerMessages = await fetch(
    `${baseUrl}/sessions/${session.id}/messages`,
    { headers: { Authorization: `Bearer ${ownerToken}` } }
  );
  assert.deepEqual((await ownerMessages.json()).messages, []);

  db.prepare(`
    INSERT INTO ai_chat_messages (session_id, user_id, role, content)
    VALUES (?, ?, 'assistant', 'A saved answer')
  `).run(session.id, ownerId);
  const persistedMessages = await fetch(
    `${baseUrl}/sessions/${session.id}/messages`,
    { headers: { Authorization: `Bearer ${ownerToken}` } }
  );
  assert.equal((await persistedMessages.json()).messages[0].content, "A saved answer");

  const deletedByOther = await fetch(`${baseUrl}/sessions/${session.id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${otherToken}` }
  });
  assert.equal(deletedByOther.status, 404);

  const deletedByOwner = await fetch(`${baseUrl}/sessions/${session.id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${ownerToken}` }
  });
  assert.equal(deletedByOwner.status, 200);
  assert.equal(db.prepare(
    "SELECT COUNT(*) AS count FROM ai_chat_messages WHERE session_id = ?"
  ).get(session.id).count, 0);
});
