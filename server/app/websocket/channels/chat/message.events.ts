import { CreateMessageForwarder } from "@/websocket/services/message.forwarder";
import {
  MessageEventsPartition,
  MessageEventsRepository,
} from "@/repository/mongo/message.items.event";

export const MessageEventRetriveEventHandler = (
  sender_id: string,
  partitions: MessageEventsPartition,
) => {
  const data = {
    channel: "message_events",
    action: "retrive",
    payload: partitions,
  };
  const sendToClient = CreateMessageForwarder(
    sender_id, // The client we wish to inform
    data, // The information we was to send
    async () => MessageEventsRepository.acknowledgePartition(sender_id, partitions),
    () => console.log("Client failed to send message"),
  );
  sendToClient();
};

interface NotifySenderMessageSenderStruct {
  sender_id: string;
  message_id: string;
}
export const MessageEventNotifySenderEventHandler = (
  sender_id: string,
  items: NotifySenderMessageSenderStruct,
) => {
  const data = {
    channel: "message_events",
    action: "recipient_acknoledgement",
    payload: items,
  };
  const sendToClient = CreateMessageForwarder(
    sender_id, // The client we wish to inform
    data, // The information we was to send
    () => undefined,
    () => console.log("Client failed to send message"),
  );
  sendToClient();
};
