const express = require("express");
const validator = require("validator");
const Contact = require("../models/Contact"); // ← Make sure this path is correct
const contactRateLimiter = require("../middleware/rateLimit");

const router = express.Router();

router.post("/", contactRateLimiter, async (req, res) => {
  try {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({
        ok: false,
        error: "Name, email and message are required."
      });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({
        ok: false,
        error: "Invalid email address."
      });
    }

    const contact = await Contact.create({
      name: validator.escape(name),
      email: email.toLowerCase(),
      message,
      ip: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.status(201).json({
      ok: true,
      message: "Message received successfully.",
      id: contact._id
    });
  } catch (error) {
    console.error("Contact route error:", error);
    res.status(500).json({
      ok: false,
      error: "Internal server error."
    });
  }
});

module.exports = router;