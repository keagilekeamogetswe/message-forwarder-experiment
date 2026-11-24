import ChatSendEventHandler from "@/websocket/channels/chat/send.handler";
import ChatBulkSendEventHandler from "@/websocket/channels/chat/bulk-send.handler";
import { MessageReadItemsEventHandler } from "@/websocket/channels/chat/message.events";
import { IChannel } from "@/websocket/types/ws.router";

export const ChannelRegistry: Record<string, IChannel> = {
  chat: {
    actions: {
      send: ChatSendEventHandler,
      bulk_send: ChatBulkSendEventHandler,
    },
  },
  message_event: {
    actions: {
      read_items: MessageReadItemsEventHandler,
    },
  },
};
