import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import LocationEmail from "../models/LocationEmail.js";
import User from "../models/User.js";
import { JWT_SECRET } from "../middleware/authMiddleware.js"; // Middleware to verify token
const router = express.Router();
dotenv.config();
// Register
router.post("/register", async (req, res) => {
    try {
      const { name, email, contactNumber, password, userType } = req.body;
  
      let user = await User.findOne({ email });
      if (user) return res.status(400).json({ message: "User already exists" });
  
      const hashedPassword = await bcrypt.hash(password, 10);
      user = new User({ name, email, contactNumber, password: hashedPassword, userType });
  
      await user.save();
      res.status(201).json({ message: "Registration successful" });
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  });
  router.get('/getworkersDetails', async (req, res) => {
    try {
      const users = await User.find({ userType: 'worker' });
  
      // Don't return passwords
      const safeUsers = users.map(user => {
        const { password, ...safeUser } = user.toObject();
        return safeUser;
      });
  
      res.status(200).json(safeUsers);
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });
  router.get('/getCustomerDetails', async (req, res) => {
    try {
      const users = await User.find({ userType: 'customer' });
  
      // Don't return passwords
      const safeUsers = users.map(user => {
        const { password, ...safeUser } = user.toObject();
        return safeUser;
      });
  
      res.status(200).json(safeUsers);
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });
// Login
router.post("/login", async (req, res) => {
    try {
      const { email, password } = req.body;
  
      const user = await User.findOne({ email });
      if (!user) return res.status(400).json({ message: "User not found" });
  
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });
  
      // Generate JWT token
      const token = jwt.sign({ userId: user._id, email: user.email, userType: user.userType }, JWT_SECRET, { expiresIn: "2m" });
  
      res.json({
        token,
        user: {
          userId: user._id,
          name: user.name,
          email: user.email,
          userType: user.userType,
        },
      });
    } catch (error) {
      console.error("Login Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  

router.get("/users", async (req, res) => {
  try {
      const users = await User.find(); // Get all users (Admin Only)

      res.json(users);
  } catch (error) {
      res.status(500).json({ message: "Server error" });
  }
});

router.post("/send-location-email", async (req, res) => {
  try {
    const {
      customerEmail,
      workerEmail,
      customerLocation
    } = req.body;

    // Save to MongoDB
    const newRecord = new LocationEmail({
      customerEmail,
      workerEmail,
      customerLocation
    });

    await newRecord.save();

    // Email setup
   const transporter = nodemailer.createTransport({
       host: "smtp.gmail.com",
       port: 465,
       secure: true, // Use SSL
       auth: {
           user: process.env.EMAIL_USERS, // Your Gmail
           pass: process.env.EMAIL_PASSS, // Your App Password
       },
     });
    // Email to Customer
    const customerMailOptions = {
      from: process.env.EMAIL_USERS,
      to: customerEmail,
      subject: "✅ Payment Successful & Booking Confirmation",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 10px;">
          <h2 style="color: #2c3e50;">👋 Hey there!</h2>
    
          <p style="font-size: 16px;">🎉 Your payment has been <strong>successfully processed</strong> and your booking is now confirmed.</p>
    
          <h3 style="color: #34495e;">📋 Booking Details</h3>
          <ul style="font-size: 15px;">
            <li><strong>Your Email:</strong> ${customerEmail}</li>
            <li><strong>Worker Email:</strong> ${workerEmail}</li>
          </ul>
    
          <h3 style="color: #34495e;">📍 Location Information</h3>
          <ul style="font-size: 15px;">
            <li><strong>Your Location:</strong> Latitude: ${customerLocation.latitude}, Longitude: ${customerLocation.longitude}
              <br/><a href="https://www.google.com/maps?q=${customerLocation.latitude},${customerLocation.longitude}" target="_blank">View on Google Maps</a>
            </li>
          </ul>
    
          <p style="margin-top: 20px; font-size: 15px;">
            🧭 <strong>Please confirm your current location.</strong> If your location has changed, kindly go to the <strong>Tracking</strong> tab inside your dashboard and click <strong>“Send Your Location”</strong>. This will automatically update your latest location in our system.
          </p>
    
          <p style="margin-top: 30px; font-size: 14px; color: #7f8c8d;">
            Thank you for choosing our service! We’re here to help you anytime.
            <br/>
            <em>This is an automated message. Please do not reply to this email.</em>
          </p>
        </div>
      `
    };
    

    // Email to Worker
    const workerMailOptions = {
      from: process.env.EMAIL_USERSS,
      to: workerEmail,
      subject: "📍 New Booking Assigned – Location & Attendance Required",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 10px;">
          <h2 style="color: #2c3e50;">👋 Hello,</h2>
    
          <p style="font-size: 16px;">You have been <strong>successfully booked</strong> for a new service by a customer.</p>
    
          <h3 style="color: #34495e;">📋 Booking Confirmation</h3>
          <ul style="font-size: 15px;">
            <li><strong>Customer Email:</strong> ${customerEmail}</li>
          </ul>
    
          <h3 style="color: #34495e;">📍 Location Details</h3>
          <ul style="font-size: 15px;">
            <li><strong>Customer's Location:</strong> Latitude: ${customerLocation.latitude}, Longitude: ${customerLocation.longitude}
              <br/><a href="https://www.google.com/maps?q=${customerLocation.latitude},${customerLocation.longitude}" target="_blank">View on Google Maps</a>
            </li>
          </ul>
    
          <p style="margin-top: 20px; font-size: 15px;">
            📦 Please prepare accordingly and ensure timely arrival at the customer's location.
          </p>
    
          <p style="margin-top: 20px; font-size: 15px; color: #c0392b;">
            ⚠️ <strong>Important:</strong> If you fail to attend this booking without prior notice, it may result in immediate termination of your service privileges on our platform.
          </p>
    
          <p style="margin-top: 30px; font-size: 14px; color: #7f8c8d;">
            This is an automated confirmation email. Please do not reply to this message.
          </p>
        </div>
      `
    };

    // Send both emails
    await transporter.sendMail(customerMailOptions);
    await transporter.sendMail(workerMailOptions);

    res.status(200).json({ message: "Location data saved and emails sent." });
  } catch (err) {
    console.error("Error sending location email:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
router.get('/tracking-link', async (req, res) => {
  const { workerEmail } = req.query;

  try {
    // Get the latest record for this worker
    const locationRecord = await LocationEmail.findOne({ workerEmail })
      .sort({ createdAt: -1 });

    if (!locationRecord || !locationRecord.customerLocation) {
      return res.status(404).json({ message: 'Customer location not found' });
    }

    const { latitude, longitude } = locationRecord.customerLocation;

    // Hardcode the worker location OR store it and retrieve dynamically
    const workerLat = 17.385044; // example: Hyderabad
    const workerLng = 78.486671;

    const mapLink = `https://www.google.com/maps/dir/?api=1&origin=${latitude},${longitude}&destination=${workerLat},${workerLng}&travelmode=driving`;

    res.json({ link: mapLink });
  } catch (error) {
    console.error('Error generating tracking link:', error);
    res.status(500).json({ message: 'Server error' });
  }
});
export default router;