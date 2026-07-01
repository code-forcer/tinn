const mongoose = require('mongoose');

const voteSchema = new mongoose.Schema({
  questionId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Question",
    required: true
  },
  selectedTerms: {
    type: [String],
    required: true,
    validate: {
      validator: function(v) {
        return v && v.length > 0;
      },
      message: 'At least one term must be selected'
    }
  },
  ip: { 
    type: String,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  deviceId: String,
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
});

// Index for faster queries
voteSchema.index({ questionId: 1, ip: 1 });
voteSchema.index({ questionId: 1, createdAt: -1 });

module.exports = mongoose.model("Vote", voteSchema);