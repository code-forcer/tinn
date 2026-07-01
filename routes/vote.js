const express = require('express');
const router = express.Router();
const Vote = require('../models/Vote');
const VoteIP = require('../models/VoteIP');
const Question = require('../models/Question');
const verifyToken = require('../middleware/verifyToken');
const optionalAuth = require('../middleware/optionalAuth');

// Helper to get IP in various deployments
function getIP(req) {
  return (req.headers['x-forwarded-for'] || req.ip || req.connection?.remoteAddress || '').split(',')[0].trim();
}

router.post('/', optionalAuth, async (req, res) => {
  try {
    const { terms, questionId } = req.body;
    if (!Array.isArray(terms) || terms.length === 0) {
      return res.status(400).json({ message: 'Please provide terms (array)' });
    }

    // Get the question (if not provided use active)
    let question = null;
    if (questionId) {
      question = await Question.findById(questionId);
    } else {
      question = await Question.findOne({ active: true });
    }
    if (!question) return res.status(404).json({ message: 'No active question found' });

    const ip = getIP(req);

    // Check IP already voted for this question
    const already = await VoteIP.findOne({ questionId: question._id, ip });
    if (already) return res.status(403).json({ message: 'You have already voted (IP)' });

    // Save vote
    await Vote.create({
      questionId: question._id,
      selectedTerms: terms,
      ip,
      userId: req.user ? req.user.userId : null, // 👈 allow null
    });

    // Mark IP
    try {
      await VoteIP.create({ questionId: question._id, ip });
    } catch (e) {
      // ignore duplicate key race condition
    }

    res.json({ message: 'Vote submitted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
