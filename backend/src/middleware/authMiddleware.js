const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");

function verifyToken(req) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.split(" ")[1];

  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET not configured");
  }

  return jwt.verify(token, process.env.JWT_SECRET);
}

async function requireAuth(req, res, next) {
  try {
    const decoded = verifyToken(req);

    if (!decoded) {
      return res.status(401).json({
        error: "Authentication token required",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, role: true },
    });

    if (!user) {
      return res.status(401).json({
        error: "User not found",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
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

async function requireManager(req, res, next) {
  try {
    const decoded = verifyToken(req);

    if (!decoded) {
      return res.status(401).json({
        error: "Authentication token required",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, role: true },
    });

    if (!user || !["MANAGER", "ADMIN"].includes(user.role)) {
      return res.status(403).json({
        error: "Manager access required",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
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

async function requireAdmin(req, res, next) {
  try {
    const decoded = verifyToken(req);

    if (!decoded) {
      return res.status(401).json({
        error: "Authentication token required",
      });
    }

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

module.exports = { requireAuth, requireManager, requireAdmin };