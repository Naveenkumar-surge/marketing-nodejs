const mongoose = require("mongoose");

const WorkerSchema = new mongoose.Schema({
    name :{ type: String, required: true },
    email: { type: String, required: true, unique: true },
    services: [String],
    price: { type: Number, required: true },
    availability: {
        from: { type: String, required: true },
        to: { type: String, required: true }
    },
    isBusy: { type: Boolean, default: false }, // 👈 already present

    // 🔑 Added keys
    workerKey: { type: String, required: true },
    customerKey: { type: String, required: true }
});

module.exports = mongoose.model("Worker", WorkerSchema);
