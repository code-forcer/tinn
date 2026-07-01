// backend/routes/share.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { createCanvas } = require("@napi-rs/canvas");
const Vote = require("../models/Vote");
const Question = require("../models/Question");

const FIXED_TERMS = [
  "Unconstitutional", "Corrupt", "Illegal", "Outrageous", "Embarrassing", "Immoral",
  "Disgusting", "Grifting", "Cheating", "Insulting", "Sadistic", "Moronic",
  "Immature", "Dumb/Stupid", "Narcissistic", "Pathetic", "Beyond Words", "Nepotism",
  "Cronyism", "Incomprehensible", "Pandering", "Dangerous", "Deplorable", "Hypocritical"
];

// GET /api/share/:questionId  -> PNG image (1200x630) for OG/Twitter previews
router.get("/:questionId", async (req, res) => {
  try {
    const { questionId } = req.params;

    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).send("Question not found");
    }

    const matchStage = { questionId: new mongoose.Types.ObjectId(questionId) };

    // Same aggregation shape as results.js, trimmed to what we need for the image
    const counts = await Vote.aggregate([
      { $match: matchStage },
      { $unwind: "$selectedTerms" },
      {
        $group: {
          _id: { $trim: { input: "$selectedTerms" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const totalSelections = counts.reduce((sum, item) => sum + item.count, 0);
    const totalVoters = await Vote.distinct("userId", matchStage).then(arr => arr.length);

    const top = counts[0]; // { _id: term, count }
    const topTerm = top ? top._id : null;
    const topPercentage = top && totalSelections > 0
      ? ((top.count / totalSelections) * 100).toFixed(1)
      : null;

    // ---- Draw the image ----
    const width = 1200;
    const height = 630;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // Background
    ctx.fillStyle = "#0f0f0f";
    ctx.fillRect(0, 0, width, height);

    // Accent bar
    ctx.fillStyle = "#ff3b30";
    ctx.fillRect(0, 0, width, 12);

    // Question text (wrapped)
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 54px sans-serif";
    const questionBottomY = wrapText(ctx, question.text, 80, 180, width - 160, 64);

    // Top reaction badge
    if (topTerm) {
      ctx.font = "bold 40px sans-serif";
      ctx.fillStyle = "#ff3b30";
      ctx.fillText(`Top Reaction: ${topTerm}${topPercentage ? ` (${topPercentage}%)` : ""}`,
        80, questionBottomY + 70);
    }

    // Voter count
    ctx.font = "30px sans-serif";
    ctx.fillStyle = "#aaaaaa";
    ctx.fillText(`${totalVoters} voter${totalVoters === 1 ? "" : "s"}`, 80, questionBottomY + 120);

    // Footer / branding
    ctx.font = "32px sans-serif";
    ctx.fillStyle = "#666666";
    ctx.fillText("This Is Not Normal", 80, height - 60);

    const buffer = canvas.toBuffer("image/png");
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(buffer);

  } catch (err) {
    console.error("Share image error:", err);
    res.status(500).send("Error generating image");
  }
});

// Wraps text within maxWidth, returns the Y position after the last line drawn
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  let curY = y;
  for (const word of words) {
    const testLine = line + word + " ";
    if (ctx.measureText(testLine).width > maxWidth && line !== "") {
      ctx.fillText(line, x, curY);
      line = word + " ";
      curY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, curY);
  return curY;
}

module.exports = router;