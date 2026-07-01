// backend/routes/dashboard.js - FIXED PERCENTAGES
const express = require("express");
const router = express.Router();
const User = require("../models/User");
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

router.get("/", optionalAuth, async (req, res) => {
  try {
    // ===== CORE DATABASE STATS =====
    const [totalUsers, totalQuestions, activePolls, totalVotes] = await Promise.all([
      User.countDocuments(),
      Question.countDocuments(),
      Question.countDocuments({ active: true }),
      Vote.countDocuments()
    ]);

    // ===== OVERALL SYSTEM VOTE STATISTICS =====
    const systemVoteStats = await Vote.aggregate([
      {
        $facet: {
          uniqueVoters: [
            { $group: { _id: "$userId" } },
            { $count: "count" }
          ],
          termCounts: [
            { $unwind: "$selectedTerms" },
            {
              $group: {
                _id: { $trim: { input: "$selectedTerms" } },
                count: { $sum: 1 }
              }
            },
            { $sort: { count: -1 } }
          ],
          totalSelections: [
            { $unwind: "$selectedTerms" },
            { $count: "count" }
          ]
        }
      }
    ]);

    const uniqueVoters = systemVoteStats[0]?.uniqueVoters[0]?.count || 0;
    const totalSelections = systemVoteStats[0]?.totalSelections[0]?.count || 0;
    const termCountsArray = systemVoteStats[0]?.termCounts || [];

    // Create term counts map
    const termCounts = {};
    termCountsArray.forEach(item => {
      termCounts[item._id] = item.count;
    });

    // Calculate average selections per voter
    const avgSelectionsPerVote = uniqueVoters > 0 
      ? parseFloat((totalSelections / uniqueVoters).toFixed(2))
      : 0;

    // ===== ALL TERMS WITH CORRECT STATS (for full table) =====
    const allTermsStats = FIXED_TERMS.map(term => {
      const count = termCounts[term] || 0;
      return {
        term,
        count,
        // Percentage of total selections (this should always be <= 100%)
        percentage: totalSelections > 0 
          ? parseFloat((Math.min((count / totalSelections) * 100, 100)).toFixed(1))
          : 0,
        // Percentage relative to all selections (proper distribution)
        percentageOfSelections: totalSelections > 0 
          ? parseFloat(((count / totalSelections) * 100).toFixed(1))
          : 0
      };
    }).sort((a, b) => b.count - a.count);

    // Top 5 for quick view
    const top5 = allTermsStats.slice(0, 5);

    // ===== ACTIVE QUESTION STATS =====
    const activeQuestion = await Question.findOne({ active: true });
    let activeQuestionStats = null;

    if (activeQuestion) {
      const questionVoteStats = await Vote.aggregate([
        { 
          $match: { 
            questionId: new mongoose.Types.ObjectId(activeQuestion._id) 
          } 
        },
        {
          $facet: {
            uniqueVoters: [
              { $group: { _id: "$userId" } },
              { $count: "count" }
            ],
            termCounts: [
              { $unwind: "$selectedTerms" },
              {
                $group: {
                  _id: { $trim: { input: "$selectedTerms" } },
                  count: { $sum: 1 }
                }
              },
              { $sort: { count: -1 } }
            ],
            totalSelections: [
              { $unwind: "$selectedTerms" },
              { $count: "count" }
            ]
          }
        }
      ]);

      const questionVoters = questionVoteStats[0]?.uniqueVoters[0]?.count || 0;
      const questionSelections = questionVoteStats[0]?.totalSelections[0]?.count || 0;
      const questionTermsArray = questionVoteStats[0]?.termCounts || [];

      // Map for question terms
      const questionTermsMap = {};
      questionTermsArray.forEach(item => {
        questionTermsMap[item._id] = item.count;
      });

      // All terms for this question with CORRECT percentages
      const questionAllTerms = FIXED_TERMS.map(term => {
        const count = questionTermsMap[term] || 0;
        return {
          term,
          count,
          // Percentage of all selections for this question
          percentage: questionSelections > 0
            ? parseFloat(((count / questionSelections) * 100).toFixed(1))
            : 0,
          // Same as above - just percentage of selections
          percentageOfSelections: questionSelections > 0
            ? parseFloat(((count / questionSelections) * 100).toFixed(1))
            : 0
        };
      }).sort((a, b) => b.count - a.count);

      activeQuestionStats = {
        totalVoters: questionVoters,
        totalSelections: questionSelections,
        avgSelections: questionVoters > 0 
          ? parseFloat((questionSelections / questionVoters).toFixed(2))
          : 0,
        topTerms: questionAllTerms.slice(0, 10),
        allTerms: questionAllTerms
      };
    }

    // ===== ALL QUESTIONS WITH THEIR STATS =====
    const allQuestions = await Question.find().sort({ pubDate: -1 });
    
    const questionsWithStats = await Promise.all(
      allQuestions.map(async (q) => {
        const qStats = await Vote.aggregate([
          { 
            $match: { 
              questionId: new mongoose.Types.ObjectId(q._id) 
            } 
          },
          {
            $facet: {
              uniqueVoters: [
                { $group: { _id: "$userId" } },
                { $count: "count" }
              ],
              totalSelections: [
                { $unwind: "$selectedTerms" },
                { $count: "count" }
              ],
              topTerm: [
                { $unwind: "$selectedTerms" },
                {
                  $group: {
                    _id: { $trim: { input: "$selectedTerms" } },
                    count: { $sum: 1 }
                  }
                },
                { $sort: { count: -1 } },
                { $limit: 1 }
              ]
            }
          }
        ]);

        const voters = qStats[0]?.uniqueVoters[0]?.count || 0;
        const selections = qStats[0]?.totalSelections[0]?.count || 0;
        const topTerm = qStats[0]?.topTerm[0];

        return {
          id: q._id,
          text: q.text,
          pubDate: q.pubDate,
          active: q.active,
          stats: {
            voters,
            selections,
            avgSelections: voters > 0 ? parseFloat((selections / voters).toFixed(2)) : 0,
            topTerm: topTerm ? {
              term: topTerm._id,
              count: topTerm.count,
              // Correct percentage: part of all selections
              percentage: selections > 0 
                ? parseFloat(((topTerm.count / selections) * 100).toFixed(1))
                : 0
            } : null
          }
        };
      })
    );

    // ===== USER INFO =====
    let dashboardUser = {
      userId: null,
      role: "guest",
      email: "guest@thisisnotnormal.social",
      fullname: "Guest User",
      siteid: "Jsx3w363825394#529384",
    };

    if (req.user) {
      const user = await User.findById(req.user.userId);
      if (user) {
        dashboardUser = {
          userId: user._id,
          role: user.role,
          email: user.email,
          fullname: user.fullName,
          siteid: user.siteid,
        };
      }
    }

    // ===== ENGAGEMENT METRICS =====
    const engagementRate = totalUsers > 0 
      ? parseFloat((Math.min((uniqueVoters / totalUsers) * 100, 100)).toFixed(1))
      : 0;

    const votesPerQuestion = totalQuestions > 0
      ? parseFloat((totalVotes / totalQuestions).toFixed(1))
      : 0;

    // ===== TERM PARTICIPATION ANALYSIS =====
    const termParticipation = {
      mostPopular: allTermsStats[0],
      leastPopular: allTermsStats[allTermsStats.length - 1],
      above50Percent: allTermsStats.filter(t => t.percentage > 50).length,
      unused: allTermsStats.filter(t => t.count === 0).length
    };

    // ===== COMPLETE DASHBOARD PAYLOAD =====
    const dashboardData = {
      ...dashboardUser,
      
      // Core stats
      stats: {
        users: totalUsers,
        pollsCreated: totalQuestions,
        activePolls: activePolls,
        totalVotes: totalVotes,
        uniqueVoters: uniqueVoters,
        totalSelections: totalSelections,
        avgSelections: avgSelectionsPerVote,
        engagementRate: engagementRate,
        votesPerQuestion: votesPerQuestion,
      },

      // Active question
      activeQuestion: activeQuestion ? {
        id: activeQuestion._id,
        text: activeQuestion.text,
        pubDate: activeQuestion.pubDate,
        active: activeQuestion.active,
        stats: activeQuestionStats
      } : null,

      // All system data
      systemData: {
        allTerms: allTermsStats,
        top5,
        termParticipation,
        totalSelections,
        totalVoters: uniqueVoters
      },

      // All questions
      allQuestions: questionsWithStats,

      // Legacy support
      voteData: termCounts,
      top5,

      message: "Enhanced dashboard data loaded successfully",
    };

    // Debug log
    console.log("Enhanced Dashboard Stats:", {
      totalUsers,
      totalQuestions,
      uniqueVoters,
      totalSelections,
      allTermsCount: allTermsStats.length,
      questionsWithStats: questionsWithStats.length,
      topTerm: allTermsStats[0]?.term
    });

    res.json(dashboardData);
    
  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).json({ 
      message: "Server error", 
      error: err.message 
    });
  }
});

module.exports = router;