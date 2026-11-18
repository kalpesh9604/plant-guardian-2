require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const db = require("./database/db");

const app = express();
const PORT = process.env.PORT || 5000;
const allowedOrigins = (
  process.env.CORS_ORIGIN ||
  "http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174,https://localhost"
)
  .split(",")
  .map(origin => origin.trim())
  .filter(Boolean);

if (!process.env.JWT_SECRET || Buffer.byteLength(process.env.JWT_SECRET) < 32) {
  throw new Error("JWT_SECRET must be configured with at least 32 characters.");
}

app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    callback(new Error("Origin is not allowed by CORS."));
  }
}));
app.use(express.json({ limit: "1mb" }));

require("./database/schema");

app.use("/api/auth", require("./routes/auth"));
app.use("/api/plants", require("./routes/plants"));
app.use("/api/care", require("./routes/care"));
app.use("/api/reminders", require("./routes/reminders"));
app.use("/api/ai/chat", require("./routes/chat"));
app.use("/api/ai", require("./routes/ai"));
app.use("/api/ai", require("./routes/imageAnalysis"));
app.use("/api/dashboard", require("./routes/dashboard"));
app.get("/", (req, res) => {
  res.json({
    message: "Plant Guardian API is running!",
    status: "success"
  });
});

app.get("/api/health", (req, res) => {
  db.prepare("SELECT 1").get();
  res.json({ status: "healthy", database: "connected" });
});

app.use((req, res) => {
  res.status(404).json({ message: "API endpoint not found." });
});

app.use((error, req, res, next) => {
  console.error("Unhandled API error:", error.message);
  if (res.headersSent) return next(error);

  const status = error.status === 413 ? 413 : 500;
  res.status(status).json({
    message: status === 413 ? "Request body is too large." : "An unexpected server error occurred."
  });
});

app.listen(PORT, () => {
  console.log(`Plant Guardian server running on port ${PORT}`);
});