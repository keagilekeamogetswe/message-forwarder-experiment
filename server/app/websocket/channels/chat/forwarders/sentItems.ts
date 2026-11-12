import { CreateMessageForwarder } from "@/websocket/services/message.forwarder";
import { ClientRegistry } from "@/websocket/services/client.registry";
import { MessageEventsRepository } from "@/repository/mongo/message.items.event";
import { MessageStruct, ReadItem, SentItem } from "@/model/message";

export const SendItemForwarder = (
  sender_id: string,
  messages: MessageStruct[],
) => {
  let message_id_list: string[] = [];
  const sent_items: SentItem[] = messages.map((sent_item) => {
    const client_id = sent_item.client_id;
    const sent_at = new Date().toISOString();
    const message_uuid = sent_item.message_uuid;
    message_id_list.push(message_uuid);
    return { client_id, message_uuid, sent_at };
  });
  return CreateMessageForwarder(
    sender_id, // The client we wish to inform
    {
      channe: "chat",
      action: "sent_items",
      payload: sent_items,
    }, // The information we was to send
    () => console.log("Messages arrived at destination..."), //Means client is live on the websocket to have recieved this
    async () => {
      const message_saved = await MessageEventsRepository.sentItems.persist(
        sender_id,
        sent_items,
      ); //Client not live so the sent items are persisted to the database
      if (!message_saved) {
        console.error("Read items could not be saved to server");
        return;
      }
    },
  );
};
