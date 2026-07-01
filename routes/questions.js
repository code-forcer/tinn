const express = require('express');
const router = express.Router();
const Question = require('../models/Question');
const verifyToken = require('../middleware/verifyToken');
const requireAdmin = require('../middleware/requireAdmin');
const optionalAuth = require('../middleware/optionalAuth');

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