const rateLimit = require("express-rate-limit");

const contactRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: {
    ok: false,
    error: "Too many requests. Please try again later."
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = contactRateLimiter;
