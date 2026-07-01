const express = require('express');
const router = express.Router();
const Question = require('../models/Question');
const Vote = require('../models/Vote');
const verifyToken = require('../middleware/verifyToken');
const requireAdmin = require('../middleware/requireAdmin');
const optionalAuth = require('../middleware/optionalAuth');

// Static export build needs this to know every /poll/[id] route at build time.
// Must stay above any "/:id" style route.
router.get("/ids", async (req, res) => {
  try {
    const questions = await Question.find({}, '_id');
    res.json(questions);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Bulk build-time data: question text + top reaction term for EVERY question
// in a single response, so generateMetadata doesn't need one fetch per page
// (avoids hammering the backend with hundreds of parallel requests during build).
router.get("/build-data", async (req, res) => {
  try {
    const questions = await Question.find({}, '_id text');

    const topTermsByQuestion = await Vote.aggregate([
      { $unwind: '$selectedTerms' },
      {
        $group: {
          _id: {
            questionId: '$questionId',
            term: { $trim: { input: '$selectedTerms' } }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      {
        $group: {
          _id: '$_id.questionId',
          topTerm: { $first: '$_id.term' },
          topCount: { $first: '$count' },
          totalSelections: { $sum: '$count' }
        }
      }
    ]);

    const resultsMap = {};
    topTermsByQuestion.forEach(item => {
      resultsMap[item._id.toString()] = {
        topTerm: item.topTerm,
        topPercentage: item.totalSelections > 0
          ? parseFloat(((item.topCount / item.totalSelections) * 100).toFixed(1))
          : null
      };
    });

    const data = questions.map(q => ({
      id: q._id.toString(),
      text: q.text,
      topTerm: resultsMap[q._id.toString()]?.topTerm || null,
      topPercentage: resultsMap[q._id.toString()]?.topPercentage || null
    }));

    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

router.get("/", optionalAuth, async (req, res) => {
  try {
    const all = await Question.find().sort({ createdAt: -1 });

    const active = await Question.findOne({ active: true })
      .select("text pubDate createdAt active");

    res.json({
      data: all,
      active,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Admin: create a question
router.post('/', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { text, pubDate } = req.body;
    if (!text) return res.status(400).json({ message: 'text required' });
    
    const questionData = { text };
    if (pubDate) {
      questionData.pubDate = new Date(pubDate);
    }
    
    const q = await Question.create(questionData);
    res.json({ message: 'Question created', question: q });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Admin: activate a question (deactivate others)
router.post('/activate/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    // deactivate all
    await Question.updateMany({}, { $set: { active: false } });
    // activate chosen
    const q = await Question.findByIdAndUpdate(id, { $set: { active: true } }, { new: true });
    res.json({ message: 'Activated', question: q });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Admin: update a question
router.put('/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { text, pubDate } = req.body;
    
    const updateData = {};
    if (text) updateData.text = text;
    if (pubDate !== undefined) {
      updateData.pubDate = pubDate ? new Date(pubDate) : null;
    }
    
    const q = await Question.findByIdAndUpdate(id, updateData, { new: true });
    
    if (!q) {
      return res.status(404).json({ message: 'Question not found' });
    }
    
    res.json({ message: 'Question updated', question: q });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Admin: delete a question
router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const q = await Question.findByIdAndDelete(id);
    
    if (!q) {
      return res.status(404).json({ message: 'Question not found' });
    }
    
    res.json({ message: 'Question deleted', question: q });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;