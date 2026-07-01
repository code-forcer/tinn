"use strict";

/* =========================================
   1. Imports
========================================= */
// Core Node modules
const http = require("http");

// Third-party modules
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

// Local modules
const { startGeoLocationCronJob } = require("./jobs/processVoteGeoLocations");

/* =========================================
   2. Configuration & Validation
========================================= */
const MONGO_URI = process.env.MONGODB_URI;
const PORT = process.env.PORT || 5000;

if (!MONGO_URI) {
  console.error("[CRITICAL] MONGODB_URI is missing in environment variables.");
  process.exit(1);
}

/* =========================================
   3. App Setup & Middleware
========================================= */
const app = express();
app.set("trust proxy", 1);

// Parser middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// CORS middleware// Define the origins you want to allow
const allowedOrigins = [
  process.env.FRONTEND_URL, 
  "http://localhost:3000"
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

/* =========================================
   4. Database Logic
========================================= */
mongoose.set("strictQuery", true);
mongoose.set("bufferCommands", false);

let isMongoConnected = false;
let reconnectTimer = null;

const connectToMongo = async () => {
  if (isMongoConnected) return;

  try {
    console.log("[DB] Attempting connection...");
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      family: 4, // Forces IPv4
    });

    isMongoConnected = true;
    console.log("[DB] Connected successfully.");

    // Start cron job only after successful connection
    startGeoLocationCronJob();

  } catch (err) {
    console.error(`[DB] Connection failed: ${err.message}`);
    scheduleReconnect();
  }
};

const scheduleReconnect = () => {
  if (reconnectTimer) return;
  console.log("[DB] Scheduling reconnect in 5s...");
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectToMongo();
  }, 5000);
};

// Database Event Listeners
mongoose.connection.on("disconnected", () => {
  isMongoConnected = false;
  console.warn("[DB] Disconnected.");
  scheduleReconnect();
});

mongoose.connection.on("reconnected", () => {
  isMongoConnected = true;
  console.log("[DB] Reconnected.");
});

mongoose.connection.on("error", (err) => {
  console.error(`[DB] Runtime error: ${err.message}`);
});

/* =========================================
   5. Routes
========================================= */
// Health Check
app.get("/api/health", (req, res) => {
  const state = mongoose.connection.readyState;
  const stateMap = { 0: "disconnected", 1: "connected", 2: "connecting", 3: "disconnecting" };

  res.json({
    status: "OK",
    uptime: process.uptime(),
    mongo: stateMap[state] || "unknown",
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/dashboard", require("./routes/dashboard"));
app.use("/api/questions", require("./routes/questions"));
app.use("/api/vote", require("./routes/vote"));
app.use("/api/results", require("./routes/results"));
app.use("/api/admin", require("./routes/adminImport"));
app.use("/api/contact", require("./routes/contact"));
app.use("/api/admin/admincontacts", require("./routes/adminContacts"));
app.use("/api/votes", require("./routes/voteGeoData"));

/* =========================================
   6. Error Handling
========================================= */
// Global Express Error Handler
app.use((err, req, res, next) => {
  console.error("[SERVER] Express error:", err);
  // Ensure we don't send a response if one was already sent
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({ error: "Internal Server Error" });
});

/* =========================================
   7. Process Safety & Shutdown
========================================= */
process.on("unhandledRejection", (reason) => {
  console.error("[PROCESS] Unhandled Rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[PROCESS] Uncaught Exception:", err);
  // Application continues running per your logic, though restart is recommended
});

const shutdown = (signal) => {
  console.log(`[PROCESS] ${signal} received. Shutting down...`);
  server.close(() => {
    mongoose.connection.close(false, () => {
      console.log("[DB] Connection closed.");
      process.exit(0);
    });
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

/* =========================================
   8. Server Start
========================================= */
const server = http.createServer(app);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[SERVER] Running on port ${PORT}`);
  connectToMongo(); // Initialize DB after server is listening
});