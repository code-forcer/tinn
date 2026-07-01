// backend/routes/results.js - FIXED PERCENTAGES
const express = require("express");
const router = express.Router();
const Vote = require("../models/Vote");
const Question = require("../models/Question");
const mongoose = require("mongoose");
const optionalAuth = require("../middleware/optionalAuth");

const FIXED_TERMS = [
  "Unconstitutional", "Corrupt", "Illegal", "Outrageous", "Embarrassing", "Immoral",
  "Disgusting", "Grifting", "Cheating", "Insulting", "Sadistic", "Moronic",
  "Immature", "Dumb/Stupid", "Narcissistic", "Pathetic", "Beyond Words", "Nepotism",
  "Cronyism", "Incomprehensible", "Pandering", "Dangerous", "Deplorable", "Hypocritical"
];

// GET results for a specific question OR all questions combined
router.get('/:questionId?', optionalAuth, async (req, res) => {
  try {
    let { questionId } = req.params;
    let question;
    let matchStage = {};

    // Determine which question(s) to get results for
    if (!questionId || questionId === 'all') {
      // Get ALL questions combined (for Backend Stats)
      question = null;
      matchStage = {}; // No filter = all votes
    } else {
      // Get specific question
      question = await Question.findById(questionId);
      if (!question) {
        return res.status(404).json({ message: 'Question not found' });
      }
      matchStage = { questionId: new mongoose.Types.ObjectId(questionId) };
    }

    // Aggregate votes with proper term normalization
    const pipeline = [
      { $match: matchStage },
      { $unwind: '$selectedTerms' },
      {
        $group: {
          _id: { $trim: { input: '$selectedTerms' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ];

    const counts = await Vote.aggregate(pipeline);

    // Create a map of term counts
    const voteMap = {};
    counts.forEach(item => {
      const normalizedTerm = item._id.trim();
      voteMap[normalizedTerm] = item.count;
    });

    // Get total unique voters
    const totalVoters = await Vote.distinct(
      'userId', 
      matchStage
    ).then(arr => arr.length);

    // Calculate total selections (sum of all term counts)
    const totalSelections = counts.reduce((sum, item) => sum + item.count, 0);

    // Build results array with CORRECT percentages
    const results = FIXED_TERMS.map(term => {
      const count = voteMap[term] || 0;
      
      return {
        term,
        count,
        // Percentage of ALL selections (this shows distribution)
        // Sum of all percentages = 100%
        percentageOfSelections: totalSelections > 0 
          ? parseFloat(((count / totalSelections) * 100).toFixed(1))
          : 0,
        // How many times this term was selected relative to total selections
        // This is the correct metric to show
        percentage: totalSelections > 0 
          ? parseFloat(((count / totalSelections) * 100).toFixed(1))
          : 0
      };
    });

    // Sort by count
    results.sort((a, b) => b.count - a.count);

    // Return results
    res.json({
      question: question ? {
        id: question._id,
        text: question.text,
        pubDate: question.pubDate,
        active: question.active
      } : null,
      scope: questionId === 'all' || !questionId ? 'all-questions' : 'single-question',
      totalVoters,
      totalSelections,
      results,
      stats: {
        uniqueTermsVoted: counts.length,
        averageSelectionsPerVoter: totalVoters > 0 
          ? parseFloat((totalSelections / totalVoters).toFixed(2))
          : 0
      }
    });

  } catch (err) {
    console.error("Results error:", err);
    res.status(500).json({ 
      message: 'Server error', 
      error: err.message 
    });
  }
});

module.exports = router;