const Database = require("better-sqlite3");
const path = require("path");

const dbPath = process.env.PLANT_GUARDIAN_DB_PATH ||
  path.join(__dirname, "plantguardian.db");

const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

console.log("Plant Guardian database connected!");

module.exports = db;
