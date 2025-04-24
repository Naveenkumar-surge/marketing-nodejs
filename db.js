import mongoose from "mongoose";
import { GridFSBucket } from "mongodb";

let gfs;

export const connectDB = async () => {
  const conn = await mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  const db = mongoose.connection.db;
  gfs = new GridFSBucket(db, {
    bucketName: "uploads",
  });

  console.log("MongoDB Connected");
};

// Getter to access gfs
export const getGFS = () => gfs;
