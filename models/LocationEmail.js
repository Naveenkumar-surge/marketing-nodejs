const mongoose = require("mongoose");

const LocationEmailSchema = new mongoose.Schema({
  customerEmail: String,
  workerEmail: String,
  customerLocation: {
    latitude: Number,
    longitude: Number
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("LocationEmail", LocationEmailSchema);
