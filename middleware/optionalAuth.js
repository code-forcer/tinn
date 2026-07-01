const jwt = require("jsonwebtoken");

const optionalAuth = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    req.user = null; // Guest
    return next();
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // userId, role, fullname, email, siteid
    next();
  } catch (err) {
    console.warn("Invalid token, treating as guest");
    req.user = null;
    next();
  }
};

module.exports = optionalAuth;
