import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret-in-production";

export interface AuthedRequest extends Request {
  user?: { id: number; username: string; role: string; fullName: string };
}

export function authenticate(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing authentication token." });
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    req.user = { id: payload.id, username: payload.username, role: payload.role, fullName: payload.fullName };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
}

// Usage: authorize('SUPER_ADMIN', 'ICT_ADMIN')
export function authorize(...allowedRoles: string[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated." });
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "You don't have permission to perform this action." });
    }
    next();
  };
}

export function signToken(user: { id: number; username: string; role: string; fullName: string }) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: "12h" });
}
