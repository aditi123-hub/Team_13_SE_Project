const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");

async function requireAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Authentication token required",
      });
    }

    const token = authHeader.split(" ")[1];

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        error: "Authentication service is not configured",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, role: true },
    });

    if (!user || user.role !== "ADMIN") {
      return res.status(403).json({
        error: "Administrator access required",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError" ||
        error.name === "TokenExpiredError") {
      return res.status(401).json({
        error: "Invalid or expired authentication token",
      });
    }

    console.error("Authentication error:", error.message);

    return res.status(500).json({
      error: "Unable to authenticate request",
    });
  }
}

module.exports = { requireAdmin };