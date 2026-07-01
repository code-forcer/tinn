const jwt = require("jsonwebtoken");
const User = require("../models/User"); // Make sure you have a User model

// Verify JWT token
const verifyToken = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        ok: false,
        error: "Access denied. No token provided."
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find user
    const user = await User.findById(decoded.userId).select("-password");
    
    if (!user) {
      return res.status(401).json({
        ok: false,
        error: "Invalid token. User not found."
      });
    }

    // Attach user to request
    req.user = user;
    req.userId = user._id;
    
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        ok: false,
        error: "Invalid token."
      });
    }
    
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        ok: false,
        error: "Token expired."
      });
    }
    
    res.status(500).json({
      ok: false,
      error: "Authentication failed."
    });
  }
};

// Check if user is admin
const isAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      ok: false,
      error: "Authentication required."
    });
  }

  if (req.user.role !== "admin") {
    return res.status(403).json({
      ok: false,
      error: "Access denied. Admin privileges required."
    });
  }

  next();
};

// Optional: Check if user is moderator or admin
const isModeratorOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      ok: false,
      error: "Authentication required."
    });
  }

  if (req.user.role !== "admin" && req.user.role !== "moderator") {
    return res.status(403).json({
      ok: false,
      error: "Access denied. Moderator or admin privileges required."
    });
  }

  next();
};

module.exports = {
  verifyToken,
  isAdmin,
  isModeratorOrAdmin
};