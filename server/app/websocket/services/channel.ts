import ChatSendEventHandler from "@/websocket/channels/chat/send.handler";
import { IChannel } from "@/websocket/types/ws.router";

export const ChannelRegistry: Record<string, IChannel> = {
  chat: {
    actions: {
      send: ChatSendEventHandler,
    },
  },
};
