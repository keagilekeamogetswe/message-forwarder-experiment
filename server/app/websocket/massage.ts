import { RawData, WebSocket } from "ws";
import { ChannelRegistry } from "./services/channel";
import { WSMessage } from "./types/ws.router";

export async function WSMessageEventHandler(raw: RawData, ws: WebSocket) {
  let data: WSMessage;

  try {
    data = JSON.parse(raw.toString());
  } catch {
    ws.send(
      JSON.stringify({
        success: false,
        message: "Invalid JSON",
      }),
    );
    return;
  }

  const channelEntry = ChannelRegistry[data.channel];

  if (!channelEntry) {
    ws.send(
      JSON.stringify({
        success: false,
        message: "Channel not found",
      }),
    );
    return;
  }

  const handler = channelEntry.actions[data.action];

  if (!handler) {
    ws.send(
      JSON.stringify({
        success: false,
        message: "Action not found",
      }),
    );
    return;
  }

  await handler(data, ws);
}
