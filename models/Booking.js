const mongoose = require("mongoose");

const BookingSchema = new mongoose.Schema({
    customername: { type: String, required: true },
    customerEmail: { type: String, required: true },
    workername: { type: String, required: true },
    workerEmail: { type: String, required: true },
    service: { type: String, required: true },
    fromDate: { type: Date, required: true },
    toDate: { type: Date, required: true },
    price: { type: Number, required: true },
    paymentStatus: { type: String, default: "Pending" },
    completedWork: { type: String, default: "Pending" },
     rating:{ type: Number, required: true, default: 0 },
    workerKey: { type: String, required: true },
    customerKey: { type: String, required: true }
});

module.exports = mongoose.model("Booking", BookingSchema);
