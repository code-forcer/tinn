// backend/routes/auth.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const User = require("../models/User");

const transporter = nodemailer.createTransport({
  host: "mail.thisisnotnormal.social",
  port: 465,
  secure: true, // SSL/TLS because port 465
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});


// Send welcome email
const sendWelcomeEmail = async (email, name) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Welcome to This Is Not Normal Admin! 🎉",
    html: `
      <!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>Welcome to This is not normal Admin!</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        line-height: 1.6;
        color: #333;
        background-color: #f3f4f6;
        padding: 20px;
      }

      .card {
        max-width: 600px;
        margin: 0 auto;
        overflow: hidden;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        background-color: #ffffff;
      }

      .header {
        background-color: #0ea4ff;
        padding: 30px;
        text-align: center;
      }

      .header h1 {
        color: white;
        margin: 0;
        font-size: 28px;
      }

      .content {
        padding: 30px;
      }

      .content h2 {
        color: #0ea4ff;
        margin-top: 0;
      }

      .content ul {
        padding-left: 20px;
      }

      .button {
        display: inline-block;
        padding: 12px 30px;
        background-color: #0ea4ff;
        color: white;
        text-decoration: none;
        border-radius: 2px;
        font-weight: bold;
        margin: 20px 0;
        transition: background-color 0.3s;
      }

      .button:hover {
        background-color: #0288d1;
      }

      .footer {
        text-align: center;
        padding: 20px;
        font-size: 12px;
        color: #666;
        background-color: #f9fafb;
      }

      @media (max-width: 640px) {
        .card {
          width: 100%;
          margin: 10px;
        }
        .header h1 {
          font-size: 24px;
        }
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="header">
        <h1>Welcome to This Is Not Normal Admin!</h1>
      </div>
      <div class="content">
        <h2>Hi ${name},</h2>
        <p>Congratulations and welcome aboard as an <strong>This Is Not Normal Admin!</strong> Your account grants you full control over the platform.</p>

        <p>With your admin dashboard, you can:</p>
        <ul>
          <li>Create, edit, and delete polls with full CRUD functionality</li>
          <li>Manage user engagement and monitor poll participation</li>
          <li>Leverage AI-powered insights to optimize your campaigns</li>
          <li>Track analytics and generate reports in real-time</li>
          <li>Share polls and content seamlessly across social media platforms</li>
        </ul>

        <center>
          <a href="${process.env.FRONTEND_URL}/dashboard" class="button">Go to Dashboard</a>
        </center>

        <p>If you have any questions or need support, our team is here to assist you every step of the way.</p>
        <p>Best regards,<br>The ThisIsNotNormal Team</p>
      </div>
      <div class="footer">
        &copy; 2025 ThisIsNotNormal.social. All rights reserved.
      </div>
    </div>
  </body>
</html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Welcome email sent to:", email);
  } catch (error) {
    console.error("Error sending welcome email:", error);
  }
};

// Register endpoint
router.post("/register", async (req, res) => {
  try {
    const { fullName, email, password, confirmPassword } = req.body;

    // Validation
    if (!fullName || !email || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already registered",
      });
    }
    // site id 
    const siteid = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const newUser = new User({
      fullName,
      email: email.toLowerCase(),
      password: hashedPassword,
      siteid: siteid,
      role: 'admin'
    });

    await newUser.save();

    // Send welcome email (non-blocking)
    sendWelcomeEmail(email, fullName);

    // Generate JWT token
    const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.status(201).json({
      success: true,
      message: "Registration successful! Welcome to This Is Not Normal Admin!.",
      token,
      user: {
        id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        role: newUser.role,
        siteid: newUser.siteid
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
});
// Login endpoint
// Login endpoint
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
    }

    // Check if user exists
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Generate JWT token - FIXED: Include role and other fields
    const token = jwt.sign(
      { 
        userId: user._id,
        id: user._id,      // Some middleware might use 'id' instead of 'userId'
        email: user.email,
        role: user.role    // ← CRITICAL: Include the role!
      }, 
      process.env.JWT_SECRET, 
      { expiresIn: "7d" }
    );

    // Update last login (optional)
    user.lastLogin = new Date();
    await user.save();

    res.status(200).json({
      success: true,
      message: "Login successful! Welcome back.",
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        isVerified: user.isVerified,
        role: user.role  // ← Also return role so frontend knows
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
});

module.exports = router;
