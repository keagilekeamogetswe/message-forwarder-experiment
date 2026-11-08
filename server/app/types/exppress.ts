import "express";
import { UserPayload } from "./user.payload";

declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
    }
  }
}

export {};
