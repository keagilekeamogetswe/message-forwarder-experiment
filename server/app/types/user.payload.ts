import type { JWTPayload } from "jose";

export interface UserPayload extends JWTPayload {
  user_id: string;
  [key: string]: unknown;
}
