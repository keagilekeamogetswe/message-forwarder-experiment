import { RawData, WebSocket } from "ws";

export function WSMessageEventHandler(data: RawData, ws: WebSocket) {
  const message = data.toString();

  ws.send(message);
}
