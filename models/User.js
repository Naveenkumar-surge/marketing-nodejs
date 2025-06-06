const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    contactNumber: { type: String, required: true },
    password: { type: String, required: true },
    userType: { type: String, required: true },
    personalInfo: { type: Boolean, default: false },
    bankDetails: { type: Boolean, default: false },
    approved: { type: Boolean, default: false}
});

const User = mongoose.model("User", UserSchema);

module.exports = User;
