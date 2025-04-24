import express from "express";
import axios from 'axios';
import { ObjectId } from 'mongodb';
import nodemailer from "nodemailer";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { GridFSBucket } from "mongodb";
import { convertImageBufferToPdf } from "../utils/convertToPdf.js"; // Image->PDF conversion helper
import { Readable } from 'stream';
 // Import the multer configuration
import { getGFS } from "../db.js"; 
import { upload } from "../storage.js";
import PersonalInfo from '../models/PersonalInfo.js';
dotenv.config();
const router = express.Router();

router.delete('/delete', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const info = await PersonalInfo.findOne({ email });
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
      subject: 'Action Required: Personal Information Not Approved',
      text: `Dear ${info.name || 'User'},\n\n` +
        `We hope this message finds you well.\n\n` +
        `We would like to inform you that the Aadhar and PAN documents you submitted as part of your personal information were not clearly visible. Due to this, your account has not been approved at this time.\n\n` +
        `To proceed with the approval process, we kindly request you to re-upload clear and legible images of your Aadhar and PAN cards. Make sure:\n` +
        `- All text and numbers are easily readable\n` +
        `- The full document is visible without any blur or obstruction\n` +
        `- The file is in JPG, PNG, or PDF format\n\n` +
        `Once you have re-uploaded the proper documents, our team will review them, and your account will be approved within the next 24 hours.\n\n` +
        `If you have any questions or need help with the upload process, feel free to contact our support team.\n\n` +
        `Thank you for your cooperation.\n\n` +
        `Best regards,\nSupport Team`,
    };

    await transporter.sendMail(mailOptions);

    // 2. DELETE FILES FROM GRIDFS
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: 'uploads',
    });

    if (info.panFileId) {
      try {
        await bucket.delete(new mongoose.Types.ObjectId(info.panFileId));
      } catch (err) {
        console.warn(`Failed to delete PAN file with id ${info.panFileId}:`, err.message);
      }
    }

    if (info.aadharFileId) {
      try {
        await bucket.delete(new mongoose.Types.ObjectId(info.aadharFileId));
      } catch (err) {
        console.warn(`Failed to delete Aadhar file with id ${info.aadharFileId}:`, err.message);
      }
    }

    // 3. DELETE DOCUMENT FROM DB
    await PersonalInfo.deleteOne({ email });

    res.status(200).json({ message: 'Email sent, personal info and files deleted successfully' });

  } catch (err) {
    console.error('Error in deletion route:', err);
    res.status(500).json({ message: 'Internal server error during deletion' });
  }
});


// Save personal info with multiple file uploads
router.post("/", upload.fields([{ name: "aadhar" }, { name: "pan" }]), async (req, res) => {
  try {
    const {
      email,
      currentCity,
      currentAddress,
      currentPin,
      currentContact,
      permanentCity,
      permanentAddress,
      permanentPin,
      permanentContact,
      aadharNumber,
      panNumber,
    } = req.body;

    const files = req.files;
    if (!files || !files.aadhar || !files.pan) {
      return res.status(400).json({ error: "Both Aadhar and PAN files are required" });
    }

    const gfs = getGFS();

    const uploadToGridFS = (fileBuffer, filename) => {
      return new Promise((resolve, reject) => {
        const uploadStream = gfs.openUploadStream(filename);
        uploadStream.end(fileBuffer);
        uploadStream.on("finish", () => resolve(uploadStream.id));
        uploadStream.on("error", reject);
      });
    };

    // File Handling
    const aadharFile = files.aadhar[0];
    const panFile = files.pan[0];

    const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];

    if (!allowedTypes.includes(aadharFile.mimetype) || !allowedTypes.includes(panFile.mimetype)) {
      return res.status(400).json({ error: "Only JPG, PNG, and PDF formats are allowed" });
    }

    // Aadhar processing
    let aadharBuffer = aadharFile.buffer;
    let aadharFilename;

    if (aadharFile.mimetype === "application/pdf") {
      aadharFilename = `aadhar-${Date.now()}.pdf`;
    } else {
      aadharBuffer = await convertImageBufferToPdf(aadharBuffer);
      aadharFilename = `aadhar-${Date.now()}.pdf`;
    }

    // PAN processing
    let panBuffer = panFile.buffer;
    let panFilename;

    if (panFile.mimetype === "application/pdf") {
      panFilename = `pan-${Date.now()}.pdf`;
    } else {
      panBuffer = await convertImageBufferToPdf(panBuffer);
      panFilename = `pan-${Date.now()}.pdf`;
    }

    // Upload to GridFS
    const aadharFileId = await uploadToGridFS(aadharBuffer, aadharFilename);
    const panFileId = await uploadToGridFS(panBuffer, panFilename);

    // Save to DB
    const info = new PersonalInfo({
      email,
      currentCity,
      currentAddress,
      currentPin,
      currentContact,
      permanentCity,
      permanentAddress,
      permanentPin,
      permanentContact,
      aadharNumber,
      panNumber,
      aadharFileId,
      panFileId,
    });

    await info.save();
    res.status(201).json({ message: "Info saved successfully" });
  } catch (err) {
    console.error("Error saving personal info:", err);
    res.status(500).json({ error: err.message });
  }
});


router.get('/personaldetails', async (req, res) => {
  const { email } = req.query;
  console.log(email);

  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const worker = await PersonalInfo.findOne({ email });
    if (!worker) return res.status(404).json({ error: 'Worker not found' });
    console.log(res.json(worker));
    return res.json(worker);
  } catch (err) {
    console.error(err);
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
const API_KEY = "530613f5-17bf-11f0-8b17-0200cd936042"; // your 2Factor API key
const TEMPLATE_NAME = "LoginOTP";

let sessionStore = {}; // store session ID temporarily

router.post("/send-otp", async (req, res) => {
  let { contactNumber } = req.body;
  console.log(contactNumber)
  // ✅ Check if mobile is actually provided
  if (!contactNumber || typeof contactNumber !== "string") {
    return res.status(400).json({ success: false, message: "Mobile number is required" });
  }

  // ✅ Clean and normalize mobile number
  contactNumber = contactNumber.replace(/\D/g, ''); // remove non-digits
  if (!contactNumber.startsWith("91")) {
    contactNumber = `91${contactNumber}`;
  }

  try {
    const response = await axios.get(
      `https://2factor.in/API/V1/${API_KEY}/SMS/${contactNumber}/AUTOGEN/${TEMPLATE_NAME}`
    );
    const sessionId = response.data.Details;
    console.log(sessionId);
    sessionStore[contactNumber] = sessionId;
    console.log()
    res.json({ success: true, sessionId });
  } catch (error) {
    console.error(error?.response?.data || error);
    res.status(500).json({ success: false, message: "OTP sending failed" });
  }
});

router.post("/verify-otp", async (req, res) => {
  let { contactNumber, otp } = req.body;
contactNumber = contactNumber.replace(/\D/g, ''); // ✅ Now allowed
if (!contactNumber.startsWith("91")) {
  contactNumber = `91${contactNumber}`;
}
  const sessionId = sessionStore[contactNumber];
  console.log(sessionId)
  if (!sessionId) {
    return res.status(400).json({ success: false, message: "Session not found or expired. Please request a new OTP." });
  }

  try {
    const verifyRes = await axios.get(
      `https://2factor.in/API/V1/${API_KEY}/SMS/VERIFY/${sessionId}/${otp}`
    );

    const result = verifyRes.data.Details;

    if (result === "OTP Matched") {
      delete sessionStore[contactNumber]; // ✅ Only delete after success
      return res.json({ success: true });
    }

    // ⛔ Handle expired OTP
    if (result === "OTP Expired") {
      return res.status(410).json({ success: false, message: "OTP expired. Please request a new one." });
    }

    // ⛔ Invalid OTP or any other mismatch
    return res.status(401).json({ success: false, message: "Invalid OTP. Please try again." });

  } catch (error) {
    console.error(error?.response?.data || error);
    res.status(500).json({ success: false, message: "OTP verification failed. Try again later." });
  }
});

export default router;
