const mongoose = require('mongoose');
const pollSchema = new mongoose.Schema({
  question: { type: String, required: true },
  terms: { type: [String], required: true },
  results: {
    type: Map,
    of: Number,
    default: {}
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
  slug: { type: String, unique: true },
});
module.exports = mongoose.model("Poll", pollSchema);