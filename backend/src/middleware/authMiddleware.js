
const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");

const DEFAULT_IDLE_TIMEOUT_MS = 10 * 60 * 1000;

function getIdleTimeoutMs() {
  const configuredTimeout = Number(process.env.IDLE_TIMEOUT_MS);

  return Number.isFinite(configuredTimeout) && configuredTimeout > 0
    ? configuredTimeout
    : DEFAULT_IDLE_TIMEOUT_MS;
}

function verifyToken(req) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET not configured");
  }

  const token = authHeader.split(" ")[1];
  return jwt.verify(token, process.env.JWT_SECRET);
}

async function authenticate(req, res, next) {
  try {
    const decoded = verifyToken(req);

    if (!decoded) {
      return res.status(401).json({
        error: "Authentication token required",
      });
    }

    if (!decoded.sessionId) {
      return res.status(401).json({
        error: "Session expired or invalid. Please log in again.",
      });
    }

    const now = new Date();
    const idleTimeoutMs = getIdleTimeoutMs();

    // Refresh the session only if it has not already expired.
    const sessionUpdate = await prisma.userSession.updateMany({
      where: {
        id: decoded.sessionId,
        userId: decoded.userId,
        expiresAt: { gt: now },
      },
      data: {
        lastActivityAt: now,
        expiresAt: new Date(now.getTime() + idleTimeoutMs),
      },
    });

    if (sessionUpdate.count !== 1) {
      return res.status(401).json({
        error: "Session expired. Please log in again.",
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
    req.auth = decoded;

    return next();
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

function requireAuth(req, res, next) {
  return authenticate(req, res, next);
}

function requireManager(req, res, next) {
  return authenticate(req, res, (error) => {
    if (error) return next(error);

    if (!["MANAGER", "ADMIN"].includes(req.user.role)) {
      return res.status(403).json({
        error: "Manager access required",
      });
    }

    return next();
  });
}

function requireAdmin(req, res, next) {
  return authenticate(req, res, (error) => {
    if (error) return next(error);

    if (req.user.role !== "ADMIN") {
      return res.status(403).json({
        error: "Administrator access required",
      });
    }

    return next();
  });
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    return authenticate(req, res, (error) => {
      if (error) return next(error);

      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          error: "You are not authorized to access this resource",
        });
      }

      return next();
    });
  };
}

function requireTeller(req, res, next) {
  return requireRole("TELLER")(req, res, next);
}

function requireCustomer(req, res, next) {
  return requireRole("CUSTOMER")(req, res, next);
}

module.exports = {
  requireAuth,
  requireManager,
  requireAdmin,
  requireRole,
  requireTeller,
  requireCustomer,
};
