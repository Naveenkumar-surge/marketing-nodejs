import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/authroutes.js";
import Routes from "./routes/workerRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import personalInfoRoutes from "./routes/personal.js"; // 🔥 add this
import { Server } from "socket.io";
import http from "http";
import { connectDB, getGFS } from "./db.js";

dotenv.config();
const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api", Routes);
app.use("/bookings", bookingRoutes);
app.use("/api/personal-info", personalInfoRoutes); // 🔥 register route

connectDB()
  .then(() => {
    const gfs = getGFS();  // 🔥 getGFS only after DB is connected
    app.set("gfs", gfs);   // 🔥 set in app locals
    console.log("MongoDB and GridFS connected");
  })
  .catch((err) => {
    console.error("Database connection error:", err);
  });
// WebSockets for real-time notifications
const io = new Server(server, { cors: { origin: "*" } });
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("task-added", (task) => {
    io.emit("new-task", task);
  });

  socket.on("disconnect", () => console.log("User disconnected"));
});
app.set("socketio", io);

// Export GridFS getter if needed in routes
app.set("gfs", getGFS());

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
