import type { MessageStruct } from "@/model/message";
import { GroupMessageActions } from "@/actions/message/group.action";
import { PrimaryMessageActions } from "@/actions/message/primary.action";
import { RoomMessageActions } from "@/actions/message/room.actions";
import MessageRepository, { COLLECTION_NAMES } from "@/repository/mongo/message";
import type { ObjectId } from "mongodb";

export type MessageDestinationType = "room" | "primary" | "group";

export interface RoutedMessage {
  type: MessageDestinationType;
  recipient_id: string;
  message: MessageStruct;
}

const messageActions = {
  room: RoomMessageActions,
  primary: PrimaryMessageActions,
  group: GroupMessageActions,
} as const;

function routeMessage(message: MessageStruct): RoutedMessage {
  const recipient = message.recipient_id;
  const prefix = recipient[0];
  const recipient_id = recipient.slice(1).trim();

  if (!recipient_id) {
    throw new Error("Recipient must include an ID after its prefix");
  }

  let type: MessageDestinationType;
  switch (prefix) {
    case "@":
      type = "room";
      break;
    case "#":
      type = "primary";
      break;
    case "$":
      type = "group";
      break;
    default:
      throw new Error("Recipient must start with @, #, or $");
  }

  return {
    type,
    recipient_id,
    message: { ...message, recipient_id, recipient_type: type },
  };
}

export const SendMessageAction = {
  route: routeMessage,

  async persist(routed: RoutedMessage): Promise<void> {
    const persisted = await messageActions[routed.type].persistMessage(
      routed.message,
    );

    if (!persisted) {
      throw new Error("Message could not be persisted");
    }
  },

  async persistMany(routedMessages: RoutedMessage[]): Promise<void> {
    const destinations = new Map<MessageDestinationType, MessageStruct[]>();
    for (const routed of routedMessages) {
      if (routed.type === "group") {
        throw new Error("Group messages must be persisted per recipient");
      }
      const messages = destinations.get(routed.type) ?? [];
      messages.push(routed.message);
      destinations.set(routed.type, messages);
    }

    for (const [type, messages] of destinations) {
      const collection =
        type === "room" ? COLLECTION_NAMES.room : COLLECTION_NAMES.primary;
      if (!(await MessageRepository.persistMessages(collection, messages))) {
        throw new Error("Messages could not be persisted");
      }
    }
  },

  async acknowledgePrimary(userId: string, messageId: ObjectId): Promise<void> {
    await PrimaryMessageActions.acknowledgeMessages(userId, [messageId]);
  },
};
