import mongoose from "mongoose";

const personalInfoSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  currentCity: String,
  currentAddress: String,
  currentPin: String,
  currentContact: String,
  permanentCity: String,
  permanentAddress: String,
  permanentPin: String,
  permanentContact: String,
  aadharNumber: String,
  panNumber: String,
  aadharFileId: { type: mongoose.Schema.Types.ObjectId, ref: 'uploads.files' },
  panFileId: { type: mongoose.Schema.Types.ObjectId, ref: 'uploads.files' },
});

export default mongoose.model("PersonalInfo", personalInfoSchema);
