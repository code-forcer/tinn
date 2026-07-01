// routes/voteGeoData.js
const express = require('express');
const router = express.Router();
const VoteIP = require('../models/VoteIP');
const Question = require('../models/Question'); // Assuming you have this

// GET: Get all questions with vote counts
router.get('/questions-with-votes', async (req, res) => {
  try {
    const questions = await Question.find().select('_id title text');
    
    // Get vote counts for each question
    const questionsWithVotes = await Promise.all(
      questions.map(async (question) => {
        const voteCount = await VoteIP.countDocuments({ questionId: question._id });
        const processedCount = await VoteIP.countDocuments({ 
          questionId: question._id,
          'geoLocation.processed': true 
        });
        
        return {
          _id: question._id,
          title: question.title,
          text: question.text,
          totalVotes: voteCount,
          processedVotes: processedCount,
          processingProgress: voteCount > 0 ? Math.round((processedCount / voteCount) * 100) : 0
        };
      })
    );

    res.json({ questions: questionsWithVotes });

  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

// GET: Get vote locations for a specific question (individual points)
router.get('/question/:questionId/vote-map', async (req, res) => {
  try {
    const { questionId } = req.params;

    // Validate question exists
    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // Get all processed votes with geo-location for this question
    const voteIPs = await VoteIP.find({ 
      questionId,
      'geoLocation.processed': true,
      'geoLocation.lat': { $exists: true }
    }).select('geoLocation createdAt');

    // Filter for US only and format response
    const locations = voteIPs
      .filter(vote => vote.geoLocation.countryCode === 'US')
      .map(vote => ({
        lat: vote.geoLocation.lat,
        lon: vote.geoLocation.lon,
        city: vote.geoLocation.city,
        region: vote.geoLocation.region,
        votedAt: vote.createdAt
      }));

    res.json({
      questionId,
      questionTitle: question.title,
      locations,
      total: locations.length
    });

  } catch (error) {
    console.error('Error fetching vote map data:', error);
    res.status(500).json({ error: 'Failed to fetch vote locations' });
  }
});

// GET: Get aggregated state-level data for a question
router.get('/question/:questionId/vote-map-aggregated', async (req, res) => {
  try {
    const { questionId } = req.params;

    // Validate question exists
    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // Get all processed votes with geo-location
    const voteIPs = await VoteIP.find({ 
      questionId,
      'geoLocation.processed': true,
      'geoLocation.countryCode': 'US'
    }).select('geoLocation');

    // Aggregate by state
    const stateCounts = {};
    voteIPs.forEach(vote => {
      const state = vote.geoLocation.region;
      if (state) {
        stateCounts[state] = (stateCounts[state] || 0) + 1;
      }
    });

    const totalVotes = Object.values(stateCounts).reduce((a, b) => a + b, 0);

    res.json({
      questionId,
      questionTitle: question.title,
      stateCounts,
      total: totalVotes
    });

  } catch (error) {
    console.error('Error fetching aggregated vote data:', error);
    res.status(500).json({ error: 'Failed to fetch vote data' });
  }
});

// GET: Get processing status for a question
router.get('/question/:questionId/processing-status', async (req, res) => {
  try {
    const { questionId } = req.params;

    const totalVotes = await VoteIP.countDocuments({ questionId });
    const processedVotes = await VoteIP.countDocuments({ 
      questionId,
      'geoLocation.processed': true 
    });
    const pendingVotes = totalVotes - processedVotes;

    res.json({
      questionId,
      totalVotes,
      processedVotes,
      pendingVotes,
      processingProgress: totalVotes > 0 ? Math.round((processedVotes / totalVotes) * 100) : 0,
      isComplete: pendingVotes === 0
    });

  } catch (error) {
    console.error('Error fetching processing status:', error);
    res.status(500).json({ error: 'Failed to fetch processing status' });
  }
});

module.exports = router;