import multer from "multer";
import { getGFS } from "./db.js";
 // This is for accessing the GridFS instance

// Use memory storage to keep files in memory (not disk)
const storage = multer.memoryStorage();  // This stores files in memory

// Multer upload configuration
export const upload = multer({ storage });  // Multer will now store files in memory, not disk
