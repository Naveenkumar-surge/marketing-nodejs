const mongoose = require("mongoose");

const LocationEmailSchema = new mongoose.Schema({
  customerEmail: {
    type: String,
    required: true
  },
  workerEmail: {
    type: String,
    required: true
  },
  latitude: {
    type: Number,
    required: true
  },
  longitude: {
    type: Number,
    required: true
  },
  label: {
    type: String,
    default: ""
  },
  sentCount: {
    type: Number,
    default: 0  // Initialize sentCount to 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("LocationEmail", LocationEmailSchema);
