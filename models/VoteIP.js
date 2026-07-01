// models/VoteIP.js
const mongoose = require('mongoose');

const voteIPSchema = new mongoose.Schema({
  questionId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Question",
    required: true
  },
  ip: { 
    type: String,
    required: true
  },
  // NEW: Geo-location fields
  geoLocation: {
    lat: { type: Number },
    lon: { type: Number },
    city: { type: String },
    region: { type: String },
    country: { type: String },
    countryCode: { type: String },
    processed: { type: Boolean, default: false },
    processedAt: { type: Date }
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Unique compound index to prevent duplicate votes from same IP for same question
voteIPSchema.index({ questionId: 1, ip: 1 }, { unique: true });

// Index for efficient querying of unprocessed IPs
voteIPSchema.index({ 'geoLocation.processed': 1 });

module.exports = mongoose.model("VoteIP", voteIPSchema);