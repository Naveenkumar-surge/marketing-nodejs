const express = require("express");
const Booking = require("../models/Booking");
const Razorpay = require("razorpay");
const router = express.Router();

// Hardcoded Razorpay credentials for testing
const razorpay = new Razorpay({
    key_id: "rzp_test_x4xQ73ZzUCuHhh",
    key_secret: "WqMYkEfu2WkoDAtyptqxCBGl"
});
// 🔐 Random key generator function
const generateRandomKey = () => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    
    let result = '';
    for (let i = 0; i < 3; i++) {
        result += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    for (let i = 0; i < 3; i++) {
        result += numbers.charAt(Math.floor(Math.random() * numbers.length));
    }
    return result;
};
// Create Booking and Generate Razorpay Order
router.post("/create", async (req, res) => {
    try {
        const { customername,customerEmail,workername, workerEmail, service, fromDate, toDate, price } = req.body;

        if (!customerEmail || !workerEmail || !service || !fromDate || !toDate || !price) {
            return res.status(400).json({ message: "All fields are required" });
        }
        const workerKey = generateRandomKey();
        const customerKey = generateRandomKey();
        const parsedPrice = parseInt(price);
        if (isNaN(parsedPrice)) {
            return res.status(400).json({ message: "Invalid price" });
        }

        console.log("Received booking request:", req.body);

        const order = await razorpay.orders.create({
            amount: parsedPrice * 100,
            currency: "INR",
            payment_capture: 1
        });

        if (!order || !order.id) {
            return res.status(500).json({ message: "Failed to create Razorpay order" });
        }

        console.log("Razorpay Order created:", order);

        const newBooking = new Booking({
            customername,
            customerEmail,
            workername, // ✅ Add this
            workerEmail,
            service,
            fromDate,
            toDate,
            price: parsedPrice,
            paymentStatus: "Pending",
            workerKey,
            customerKey
        });

        await newBooking.save();

        res.json({ orderId: order.id, bookingId: newBooking._id });
    } catch (error) {
        console.error("Error creating booking:", error.message || error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});


// Update Payment Status
router.post("/updatePayment", async (req, res) => {
    try {
        const { bookingId, paymentId } = req.body;

        if (!bookingId || !paymentId) {
            return res.status(400).json({ message: "Missing bookingId or paymentId" });
        }

        await Booking.findByIdAndUpdate(bookingId, { paymentStatus: "Paid" });

        res.json({ message: "Payment successful!" });
    } catch (error) {
        console.error("Error updating payment:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

module.exports = router;
