// models/LocationSent.js
const mongoose = require("mongoose");

const LocationSentSchema = new mongoose.Schema({
  customerEmail: {
    type: String,
    required: true,
    unique: true
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
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("LocationSent", LocationSentSchema);
