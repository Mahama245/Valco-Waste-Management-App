import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  // Fail safely at startup rather than silently signing tokens with a
  // publicly-known default secret. A missing secret is a configuration
  // error, not something to paper over.
  throw new Error(
    "FATAL: JWT_SECRET environment variable is not set. Set it in your .env file (local) or your host's Environment settings (production). Refusing to start with an insecure default."
  );
}
// Already validated non-empty above; this explicit typing just satisfies
// TS's control-flow narrowing, which doesn't propagate into the closures below.
const SECRET: string = JWT_SECRET;

export interface AuthedRequest extends Request {
  user?: { id: number; username: string; role: string; fullName: string };
}

export function authenticate(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing authentication token." });
  try {
    const payload = jwt.verify(token, SECRET) as any;
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
  return jwt.sign(user, SECRET, { expiresIn: "12h" });
}
