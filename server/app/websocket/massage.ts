import { RawData } from "ws";
import { ChannelRegistry } from "./services/channel";
import { WSMessage } from "./types/ws.router";
import { WSClient } from "./types/ws.client";
import { CreateMessageForwarder } from "./services/message.forwarder";

export async function WSMessageEventHandler(raw: RawData, ws: WSClient) {
  const sendError = (message: Record<string, unknown>) =>
    CreateMessageForwarder(ws.user.user_id, message, () => undefined)();
  let data: WSMessage;

  try {
    data = JSON.parse(raw.toString());
  } catch {
    await sendError({ success: false, message: "Invalid JSON" });
    return;
  }

  const channelEntry = ChannelRegistry[data.channel];

  if (!channelEntry) {
    await sendError({ success: false, message: "Channel not found" });
    return;
  }

  const handler = channelEntry.actions[data.action];

  if (!handler) {
    await sendError({ success: false, message: "Action not found" });
    return;
  }

  await handler(data, ws);
}
