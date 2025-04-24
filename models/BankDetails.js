import mongoose from "mongoose";

const BankDetailsSchema = new mongoose.Schema({
  email: { type: String, required: true },
  contactNumber: { type: String, required: true },
  bankName: { type: String, required: true },
  accountNumber: { type: String, required: true },
  ifsc: { type: String, required: true },
  bankDocFileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "uploads.files", // reference to GridFS file
  },
  submitted: { type: Boolean, default: false }
});

export default mongoose.model("BankDetail", BankDetailsSchema);
