import { UserPayload } from "@/types/user.payload";
import { WebSocket } from "ws";

export interface WSClient extends WebSocket {
  isAlive: boolean;
  user: UserPayload;
}
