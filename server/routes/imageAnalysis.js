
const express = require("express");
const multer = require("multer");
const { GoogleGenAI } = require("@google/genai");
const db = require("../database/db");
const authenticateToken = require("../middleware/authMiddleware");

const router = express.Router();
router.use(authenticateToken);

function parseJsonResponse(text) {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start < 0 || end < start) {
    throw new Error("Unreadable model response");
  }

  const result = JSON.parse(cleaned.slice(start, end + 1));
  const stringFields = [
    "plantIdentification",
    "condition",
    "possibleIssue",
    "severity",
    "visualEvidence",
    "limitations"
  ];

  if (
    !result ||
    typeof result !== "object" ||
    stringFields.some(field => typeof result[field] !== "string") ||
    !Array.isArray(result.recommendations) ||
    result.recommendations.length > 10 ||
    !result.recommendations.every(item => typeof item === "string")
  ) {
    throw new Error("Model response did not match the expected schema");
  }

  return result;
}

function imageAnalysisPrompt(plant) {
  return `You are a plant health assistant.

Analyze this plant photograph.

Plant name: ${plant.name}
Species: ${plant.species || "Unknown"}

Return a JSON object with these fields:
{
  "plantIdentification": "possible plant name",
  "condition": "Healthy, Possible disease, or Unclear",
  "possibleIssue": "possible disease or issue",
  "severity": "Low, Moderate, High, or Unknown",
  "visualEvidence": "visible signs in the photograph",
  "recommendations": [
    "practical care recommendation"
  ],
  "limitations": "uncertainties or limitations"
}

Do not claim certainty from appearance alone.
If the image is unclear or does not show a plant, say so.
Return JSON only.`;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (req, file, callback) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp"
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return callback(
        new Error("Only JPG, PNG and WEBP images are allowed.")
      );
    }

    callback(null, true);
  }
});

router.post(
  "/:plantId/image-analysis",
  (req, res, next) => {
    console.info("Image analysis request received for plant:", req.params.plantId);
    next();
  },
  (req, res, next) => {
    upload.single("image")(req, res, error => {
      if (error) {
        return res.status(400).json({
          message: error.message
        });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const plantId = Number(req.params.plantId);
      if (!Number.isInteger(plantId) || plantId < 1) {
        return res.status(400).json({ message: "Invalid plant ID." });
      }

      const plant = db.prepare(`
        SELECT id, name, species FROM plants
        WHERE id = ? AND user_id = ?
      `).get(plantId, req.user.id);

      if (!plant) {
        return res.status(404).json({ message: "Plant not found." });
      }
      if (!req.file) {
        return res.status(400).json({ message: "Please upload a plant image." });
      }
      if (!process.env.GEMINI_API_KEY) {
        return res.status(503).json({
          message: "Image analysis is not configured. Add GEMINI_API_KEY to the server environment."
        });
      }

      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: { timeout: 30000 }
      });
      const model = process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-lite";
      console.info("Starting Gemini image analysis with model:", model);
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            inlineData: {
              mimeType: req.file.mimetype,
              data: req.file.buffer.toString("base64")
            }
          },
          imageAnalysisPrompt(plant)
        ],
        config: {
          maxOutputTokens: 500,
          temperature: 0.2,
          responseMimeType: "application/json"
        }
      });

      const analysis = parseJsonResponse(response.text || "");
      return res.json({
        message: "Plant image analyzed successfully.",
        plant,
        analysis,
        analysisType: "Gemini vision-based image assessment"
      });
    } catch (error) {
      const providerStatus = Number(error?.error?.code || error?.status || error?.code);
      console.error("Image analysis error:", error.message || "Unknown Gemini error");

      if (providerStatus === 429) {
        return res.status(429).json({
          message: "Gemini rate limit reached. Please wait a moment and try again."
        });
      }
      if (
        providerStatus === 401 ||
        providerStatus === 403 ||
        /API key|permission denied|unauthorized/i.test(error.message || "")
      ) {
        return res.status(503).json({
          message: "Gemini rejected the server API key. Check GEMINI_API_KEY in the server environment."
        });
      }
      if (
        providerStatus === 503 ||
        error?.status === "UNAVAILABLE" ||
        /temporarily unavailable|high demand/i.test(error.message || "")
      ) {
        return res.status(503).json({
          message: "Gemini is temporarily unavailable. Symptom-based analysis is still available; try photo analysis again shortly."
        });
      }
      if (
        providerStatus === 504 ||
        error?.status === "DEADLINE_EXCEEDED" ||
        /aborted|timed out|timeout/i.test(error.message || "")
      ) {
        return res.status(504).json({
          message: "Gemini image analysis timed out. Try a smaller image or retry shortly."
        });
      }
      if (error.message === "Unreadable model response" ||
          error.message === "Model response did not match the expected schema" ||
          error instanceof SyntaxError) {
        return res.status(502).json({
          message: "Gemini returned an unreadable analysis. Please try again."
        });
      }
      if (providerStatus === 404) {
        return res.status(503).json({
          message: "The configured Gemini model is unavailable for this API key. Check GEMINI_IMAGE_MODEL."
        });
      }
      if (/ECONNRESET|ENOTFOUND|EAI_AGAIN|network/i.test(
        `${error.code || ""} ${error.message || ""}`
      )) {
        return res.status(503).json({
          message: "The server cannot reach Gemini right now. Check its network access and try again."
        });
      }

      return res.status(502).json({
        message: "Image analysis failed. Check the server logs and Gemini API configuration."
      });
    }
  }
);

module.exports = router;
