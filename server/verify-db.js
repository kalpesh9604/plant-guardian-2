const db = require("./database/db");

const tables = db.prepare(
  "SELECT name FROM sqlite_master WHERE type = ? AND name NOT LIKE ? ORDER BY name"
).all("table", "sqlite_%");

console.log("Database tables:");
console.log(tables);

db.close();
