import express from "express";
import nodemailer from "nodemailer";
import mongoose from "mongoose";
import dotenv from "dotenv";
import Worker from "../models/workerModel.js";
import Booking from "../models/Booking.js";
import LocationEmail from "../models/LocationEmail.js";
import BankDetail from "../models/BankDetails.js";
import { ObjectId } from 'mongodb';
import { getGFS } from "../db.js"; 
import { upload } from "../storage.js";
const router = express.Router();
dotenv.config();
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

router.post("/saveWorkerDetails", async (req, res) => {
    try {
        const { name,email, services, availability, price } = req.body;

        if (!name||!email || !services.length || !availability.from || !availability.to || !price) {
            return res.status(400).json({ message: "All fields are required" });
        }

        const workerKey = generateRandomKey();
        const customerKey = generateRandomKey();

        const newWorker = new Worker({
            name,
            email,
            services,
            availability,
            price,
            workerKey,     // 🔑 Worker unique key
            customerKey    // 🔑 Customer unique key (inside Worker)
        });

        await newWorker.save();

        res.status(201).json({
            message: "Worker details saved successfully!",
            workerKey,
            customerKey
        });
    } catch (error) {
        console.error("Error saving worker details:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});
router.get("/by-customer/:email", async (req, res) => {
    try {
      const customerEmail = req.params.email;
      console.log("Requested email:", customerEmail);
  
      const bookings = await Booking.find({ customerEmail: customerEmail }); // ✅ Correct query

      if (!bookings || bookings.length === 0) {
        return res.status(404).json({ message: "No bookings found" });
      }
  
      const formattedBookings = bookings.map((booking) => ({
        customername:booking.customername,
        workername: booking.workername,
        workerEmail: booking.workerEmail,
        service: booking.service,
        fromDate: booking.fromDate,
        toDate: booking.toDate,
        workerTrackingId: booking.workerKey,
        paymentStatus:booking.paymentStatus,
        workcomplted:booking.completedWork,
        price:booking.price,
      }));
  
      res.json(formattedBookings);
    } catch (error) {
      console.error("Error fetching bookings:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });
  router.get("/by-worker/:email", async (req, res) => {
    try {
      const workerEmail = req.params.email;
      console.log("Requested email:", workerEmail);
  
      const bookings = await Booking.find({ workerEmail: workerEmail }); // ✅ Correct query

      if (!bookings || bookings.length === 0) {
        return res.status(404).json({ message: "No bookings found" });
      }
  
      const formattedBookings = bookings.map((booking) => ({
        customername:booking.customername,
        workername: booking.workername,
        customerEmail:booking.customerEmail,
        workerEmail: booking.workerEmail,
        service: booking.service,
        fromDate: booking.fromDate,
        toDate: booking.toDate,
        workerTrackingId: booking.workerKey,
        paymentStatus:booking.paymentStatus,
        workcomplted:booking.completedWork,
        price:booking.price,
      }));
  
      res.json(formattedBookings);
    } catch (error) {
      console.error("Error fetching bookings:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });
router.get("/getWorkerDetails/:email", async (req, res) => {
    try {
        const { email } = req.params;

        const worker = await Worker.findOne({ email });

        if (!worker) {
            return res.status(404).json({ message: "Worker not found" });
        }
        res.json({
            email: worker.email,
            services: worker.services,
            price: worker.price,
            availability: worker.availability,
            bookings: worker.bookings || []  // Ensure bookings is an array
        });
    } catch (error) {
        console.error("Error retrieving worker details:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});
// Fetch Available Workers
router.get("/available", async (req, res) => {
    try {
        const { service, fromDate, toDate } = req.query;

        if (!service || !fromDate || !toDate) {
            return res.status(400).json({ message: "Missing required parameters" });
        }

        const workers = await Worker.find({
            isBusy: false,
            services: { $in: [service] },
            "availability.from": { $lte: fromDate },
            "availability.to": { $gte: toDate }
          });

        res.json(workers);
    } catch (error) {
        console.error("Error fetching workers:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});


// Mark a worker as busy
router.post("/markBusy", async (req, res) => {
    try {
        const { workerEmail } = req.body;

        if (!workerEmail) {
            return res.status(400).json({ message: "Worker email is required" });
        }

        const worker = await Worker.findOneAndUpdate(
            { email: workerEmail },
            { isBusy: true },
            { new: true }
        );

        if (!worker) {
            return res.status(404).json({ message: "Worker not found" });
        }

        res.status(200).json({ message: "Worker marked as busy", worker });
    } catch (error) {
        console.error("Error marking worker as busy:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});
const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true, // Use SSL
    auth: {
        user: process.env.EMAIL_USER, // Your Gmail
        pass: process.env.EMAIL_PASS, // Your App Password
    },
  });
  // 7️⃣ Register Bank Details (with OTP verification)
  router.post(
    "/register",
    upload.single("bankDoc"),
    async (req, res) => {
      try {
        const {
          email,
          contactNumber,
          bankName,
          accountNumber,
          ifsc
        } = req.body;
  
        const file = req.file;
        if (!file) {
          return res.status(400).json({ error: "Bank document is required" });
        }
  
        const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
        if (!allowedTypes.includes(file.mimetype)) {
          return res.status(400).json({ error: "Only JPG, PNG, and PDF formats are allowed" });
        }
  
        // Convert to PDF if it's an image
        let buffer = file.buffer;
        let filename = `bankdoc-${Date.now()}.pdf`;
  
        if (file.mimetype !== "application/pdf") {
          const { convertImageBufferToPdf } = await import("../utils/imageToPdf"); // update path
          buffer = await convertImageBufferToPdf(buffer);
        }
  
        // Upload to GridFS
        const gfs = getGFS();
        const uploadStream = gfs.openUploadStream(filename);
        uploadStream.end(buffer);
  
        const bankDocFileId = await new Promise((resolve, reject) => {
          uploadStream.on("finish", () => resolve(uploadStream.id));
          uploadStream.on("error", reject);
        });
  
        // Save to DB (insert or update)
        let bankDetail = await BankDetail.findOne({ email });
        if (bankDetail) {
          bankDetail.contactNumber = contactNumber;
          bankDetail.bankName = bankName;
          bankDetail.accountNumber = accountNumber;
          bankDetail.ifsc = ifsc;
          bankDetail.bankDocFileId = bankDocFileId;
          bankDetail.submitted = true;
          await bankDetail.save();
        } else {
          bankDetail = new BankDetail({
            email,
            contactNumber,
            bankName,
            accountNumber,
            ifsc,
            bankDocFileId,
            submitted: true,
          });
          await bankDetail.save();
        }
  
        res.status(201).json({ message: "Bank details saved successfully" });
      } catch (err) {
        console.error("Error saving bank details:", err);
        res.status(500).json({ error: "Server error" });
      }
    }
  );
  
  router.post("/sendWelcomeEmail", (req, res) => {
      const { email } = req.body;
  
      // Email content
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Welcome to Marketing Site!",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 10px; overflow: hidden; box-shadow: 0 0 10px rgba(0,0,0,0.05);">
  <!-- Header -->
  <div style="background-color: #1e90ff; padding: 20px; text-align: center;">
    <img src="https://res.cloudinary.com/dhgwqmgki/image/upload/v1744577501/istockphoto-1485782945-1024x1024_gtj8tb.jpg" alt="Task Manager Logo" style="max-height: 60px;" />
    <h1 style="color: #fff; margin: 10px 0 0;">Welcome to Task Manager!</h1>
  </div>

  <!-- Body -->
  <div style="padding: 20px; color: #333;">
    <h2>Hi there 👋</h2>
    <p>Welcome to <strong>Task Manager</strong>, your go-to platform for connecting skilled workers with customers who need reliable services!</p>

    <p>Whether you're a worker looking to earn by offering your availability, or a customer seeking trustworthy help—Task Manager is designed to bridge the gap efficiently and securely.</p>

    <p><strong>Here’s how our platform works:</strong></p>
    <ul style="padding-left: 20px; line-height: 1.8;">
      <li>👷‍♂️ <strong>Workers</strong> can register their skills, availability, and service rates</li>
      <li>🧑‍💼 <strong>Customers</strong> can browse and book available workers by service and date</li>
      <li>💳 Secure online payment system powered by Razorpay</li>
      <li>📍 Real-time tracking of worker location after booking</li>
      <li>🗂️ Dedicated dashboard to manage bookings and status</li>
    </ul>

    <p><strong>As a worker, here’s what you can expect:</strong></p>
    <ul style="padding-left: 20px; line-height: 1.6;">
      <li>💼 Flexible work schedule – register when you're available</li>
      <li>💰 Get paid daily for completed jobs</li>
      <li>📲 Track bookings, earnings, and customer feedback</li>
      <li>🚀 Earn more with consistent high ratings and punctuality</li>
    </ul>

    <hr style="margin: 20px 0;" />

    <h3 style="color: #d9534f;">🚨 Platform Guidelines:</h3>
    <ul style="padding-left: 20px; line-height: 1.6;">
      <li>✅ Ensure accurate availability for smooth customer experience</li>
      <li>🔐 Never share personal OTPs or account credentials</li>
      <li>📵 Multiple accounts per person are not allowed</li>
      <li>🚫 Violating platform rules may lead to permanent suspension</li>
    </ul>

    <p>By using Task Manager, you agree to our <a href="https://your-site.com/terms" style="color: #1e90ff;">Terms of Use</a> and <a href="https://your-site.com/privacy" style="color: #1e90ff;">Privacy Policy</a>.</p>

    <!-- CTA Button -->
    <div style="text-align: center; margin: 30px 0;">
      <a href="https://your-site.com/login" style="background-color: #28a745; color: white; padding: 15px 30px; border-radius: 5px; text-decoration: none; font-weight: bold;">Login to Get Started</a>
    </div>

    <p>If you have any questions or need assistance, our support team is here for you 24/7!</p>
    <p>Best regards,<br/>Team Task Manager</p>
  </div>

  <!-- Footer -->
  <div style="background-color: #f1f1f1; text-align: center; padding: 15px; font-size: 12px; color: #888;">
    &copy; ${new Date().getFullYear()} Task Manager. All rights reserved.<br/>
    <a href="https://your-site.com/unsubscribe" style="color: #888;">Unsubscribe</a>
  </div>
</div>


        `
    };
  
      // Send email
      transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
              console.log(error);
              return res.status(500).json({ message: "Failed to send email" });
          }
          console.log("Email sent: " + info.response);
          res.status(200).json({ message: "Welcome email sent!" });
      });
  });
  const otpStore = {}; // In-memory storage (for demo; in production use Redis or DB)
  
  router.post("/send-otp", async (req, res) => {
      const { email, otp } = req.body;
  
      if (!email || !otp) {
          return res.status(400).json({ message: "Email, name, and OTP are required" });
      }
  
      // Store the OTP (You can add expiry too)
      otpStore[email] = otp;
  
      const transporter1 = nodemailer.createTransport({
          service: "gmail",
          auth: {
              user: process.env.EMAIL_USER,
              pass: process.env.EMAIL_PASS,
          },
      });
  
      const mailOptions = {
          from: process.env.EMAIL_USER,
          to: email,
          subject: "Your OTP for Registration",
          html: `<h3>Hello </h3><p>Your OTP for registration is: <strong>${otp}</strong></p>`,
      };
  
      try {
          await transporter1.sendMail(mailOptions);
          res.status(200).json({ message: "OTP sent successfully to your email" });
      } catch (error) {
          console.error("Error sending OTP email:", error.message);
          res.status(500).json({ message: "Failed to send OTP" });
      }
  });

  router.post("/contact-admin", async (req, res) => {
    const { issueType, email, description } = req.body;
  
    if (!issueType || !email || !description) {
      return res.status(400).json({ message: "All fields are required." });
    }
  
    // Email config
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  
    // Email content sent to the user
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Thanks for contacting us - Issue Received",
        html: `
          <div style="font-family: Arial, sans-serif; color: #333;">
            <h2 style="color: #2E86C1;">Hi there!</h2>
      
            <p style="font-size: 16px;">
              ✅ <strong>Thank you for reaching out to us. We've received your issue and our support team will get back to you shortly.</strong>
            </p>
      
            <p>Here are the details you submitted:</p>
      
            <table style="border-collapse: collapse; width: 100%; margin-top: 10px;">
              <tr>
                <td style="padding: 8px; border: 1px solid #ccc;"><strong>Email:</strong></td>
                <td style="padding: 8px; border: 1px solid #ccc;">${email}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ccc;"><strong>Issue Type:</strong></td>
                <td style="padding: 8px; border: 1px solid #ccc;">${issueType}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ccc;"><strong>Description:</strong></td>
                <td style="padding: 8px; border: 1px solid #ccc;">${description}</td>
              </tr>
            </table>
      
            <br/>
            <p style="margin-top: 20px;">We appreciate your feedback and are working to resolve your issue as soon as possible.</p>
      
            <br/>
            <p style="font-size: 14px; color: #888;">— Admin Support Team</p>
          </div>
        `,
      };      
  
    try {
      await transporter.sendMail(mailOptions);
      return res.status(200).json({ message: "Message sent successfully!" });
    } catch (error) {
      console.error("Email sending error:", error.message);
      return res.status(500).json({ message: "Failed to send email." });
    }
  });
  router.post("/get-bank-details", async (req, res) => {
    const { email } = req.body;
  
    try {
      const bankDetails = await BankDetail.findOne({ email, submitted: true });
  
      if (bankDetails) {
        res.json(bankDetails); // ✅ Only returning the bankDetails
      } else {
        res.status(404).json({ message: "Bank details not found." });
      }
    } catch (err) {
      console.error("Error fetching bank details:", err);
      res.status(500).json({ message: "Server error" });
    }
  });
  
  router.post("/check-user", async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: "Email is required" });
  
    try {
      const user = await User.findOne({ email });
      if (user) {
        return res.json({ success: true, message: "User exists" });
      } else {
        return res.json({ success: false, message: "Email not registered" });
      }
    } catch (error) {
      return res.status(500).json({ success: false, message: "Server error" });
    }
  });
  router.get('/details', async (req, res) => {
    try {
      const { email } = req.query;
      if (!email) return res.status(400).json({ error: 'Email is required' });
  
      const bankInfo = await BankDetail.findOne({ email });
      if (!bankInfo) return res.status(404).json({ error: 'Bank info not found' });
  
      res.json(bankInfo);
    } catch (err) {
      console.error('Error fetching bank details:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });
  router.get('/filebase64/:fileId', async (req, res) => {
    const fileId = req.params.fileId;
  
    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return res.status(400).json({ error: 'Invalid file ID' });
    }
  
    try {
      const db = mongoose.connection.db;
      const bucket = new mongoose.mongo.GridFSBucket(db, {
        bucketName: 'uploads', // Ensure your files are stored under 'uploads.files'
      });
  
      const fileStream = bucket.openDownloadStream(new ObjectId(fileId));
  
      const chunks = [];
  
      fileStream.on('data', (chunk) => {
        chunks.push(chunk);
      });
  
      fileStream.on('error', (err) => {
        console.error('Error reading from GridFS:', err);
        return res.status(500).json({ error: 'Error reading file from database' });
      });
  
      fileStream.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const base64 = buffer.toString('base64');
        res.json({ base64 }); // No need to prefix "data:application/pdf;base64," here — frontend does it
      });
  
    } catch (err) {
      console.error('Server error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });
  router.delete('/delete', async (req, res) => {
    try {
      const { email } = req.query;
      if (!email) {
        return res.status(400).json({ message: 'Email is required' });
      }
  
      const info = await BankDetail.findOne({ email });
      if (!info) {
        return res.status(404).json({ message: 'Personal info not found' });
      }
  
      // 1. SEND DELETION EMAIL BEFORE DELETION
      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
          user: process.env.EMAIL_USERS,
          pass: process.env.EMAIL_PASSS,
        },
      });
  
      const mailOptions = {
        from: process.env.EMAIL_USERS,
        to: email,
        subject: 'Action Required: Bank Document Not Approved',
        text: `Dear ${info.name || 'User'},\n\n` +
          `We hope you are doing well.\n\n` +
          `We’re pleased to inform you that your personal information has been successfully approved.\n\n` +
          `However, we noticed that the image of your bank passbook (or relevant bank document) is not clearly visible. Due to this, we are unable to approve your bank details at this time.\n\n` +
          `To proceed, please re-upload a clear and legible image of your bank passbook or statement. Make sure:\n` +
          `- The account number, IFSC code, and account holder name are clearly readable\n` +
          `- The entire document is visible without blur or obstruction\n` +
          `- The file is in JPG, PNG, or PDF format\n\n` +
          `Once your bank document is approved, you will be able to register your service and start offering it to customers on our platform.\n\n` +
          `This is a great opportunity to earn more by connecting directly with customers who need your services.\n\n` +
          `If you need any help, feel free to reach out to our support team.\n\n` +
          `Thank you for your cooperation.\n\n` +
          `Best regards,\nSupport Team`,
      };
      
  
      await transporter.sendMail(mailOptions);
  
      // 2. DELETE FILES FROM GRIDFS
      const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
        bucketName: 'uploads',
      });
  
      if (info.bankDocFileId) {
        try {
          await bucket.delete(new mongoose.Types.ObjectId(info.bankDocFileId));
        } catch (err) {
          console.warn(`Failed to delete PAN file with id ${info.bankDocFileId}:`, err.message);
        }
      }
      // 3. DELETE DOCUMENT FROM DB
      await BankDetail.deleteOne({ email });
  
      res.status(200).json({ message: 'Email sent, personal info and files deleted successfully' });
  
    } catch (err) {
      console.error('Error in deletion route:', err);
      res.status(500).json({ message: 'Internal server error during deletion' });
    }
  });
  // PUT /api/mark-work-done

  router.put('/mark-work-done', async (req, res) => {
    const { customerEmail, workerEmail, fromDate, toDate } = req.body;
  
    try {
      // 1. Mark booking as done
      const result = await Booking.updateOne(
        { customerEmail, workerEmail, fromDate, toDate },
        { $set: { completedWork: 'done' } }
      );
  
      if (result.modifiedCount === 0) {
        return res.status(404).json({ message: 'No matching booking found' });
      }
  
      // 2. Delete location entry
      await LocationEmail.deleteOne({ customerEmail, workerEmail });
  
      // 3. Delete worker
      await Worker.deleteOne({ email: workerEmail });
  
      // 4. Send emails
  
      // Customer Email
      const customerMailOptions = {
        from: process.env.EMAIL_USERS,
        to: customerEmail,
        subject: 'Thank You for Using Our Service',
        text: `
  Dear Customer,
  
  We hope you were satisfied with the service provided by our professional.
  
  Your booking has been successfully marked as completed.
  We continuously strive to improve and value your feedback — please take a moment to share your experience with us.
  Thank you for choosing our platform; we look forward to serving you again.
  
  Best regards,
  Support Team
        `
      };
  
      // Worker Email
      const workerMailOptions = {
        from: process.env.EMAIL_USERS,
        to: workerEmail,
        subject: 'Job Completed - Payment Ready',
        text: `
  Dear Professional,
  
  Thank you for choosing our platform and completing your recent service booking.
  
  Your work has been marked as completed, and the payment has been credited to your wallet section under the Payment Status tab.
  Please log in to your dashboard, navigate to the Payment section, and withdraw your available amount.
  We appreciate your service and look forward to supporting your professional journey further.
  
  Best regards,
  Support Team
        `
      };
  
      await transporter.sendMail(customerMailOptions);
      await transporter.sendMail(workerMailOptions);
  
      res.status(200).json({ message: 'Work marked as done and emails sent!' });
    } catch (error) {
      console.error('Error in mark-work-done:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  

  export default router;
