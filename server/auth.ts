import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { storage } from "./storage";

const JWT_SECRET = process.env.SESSION_SECRET || "travel-booking-secret-key";
const JWT_EXPIRES_IN = "7d";

export function signToken(payload: { userId: number; roleCode: string }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): { userId: number; roleCode: string } {
  return jwt.verify(token, JWT_SECRET) as { userId: number; roleCode: string };
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const token = authHeader.slice(7);
  try {
    const payload = verifyToken(token);
    const user = await storage.getUserById(payload.userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    (req as any).user = user;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  await requireAuth(req, res, () => {
    const user = (req as any).user;
    if (user?.roleCode !== "administrator") {
      return res.status(403).json({ message: "Forbidden: Admin access required" });
    }
    next();
  });
}
