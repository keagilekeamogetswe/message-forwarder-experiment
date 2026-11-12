import ChatSendEventHandler from "./channels/chat/send.handler";
import { IChannel } from "./types/ws.router";

export const ChannelRegistry: Record<string, IChannel> = {
  chat: {
    actions: {
      send: ChatSendEventHandler,
    },
  },
};
