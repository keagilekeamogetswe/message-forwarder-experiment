import { Request, Response, NextFunction } from "express";
import jwt from "utility/jwt";

export async function AuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const header = req.headers.authorization;

    if (!header) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!header.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Invalid authorization header",
      });
    }
    const token: string = header.replace("Bearer ", "");
    const public_key: string = process.env.JWT_ACCESS_TOKEN_PUBLIC_KEY!;
    const payload = await jwt.verify(token, public_key);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}
