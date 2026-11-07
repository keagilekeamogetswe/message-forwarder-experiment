import { RawData, WebSocket } from "ws";

export function WSMessageEventHandler(data: RawData, ws: WebSocket) {
  console.log(data.toString());
}
