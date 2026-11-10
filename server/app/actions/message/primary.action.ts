import { MessageStruct } from "@/model/message";
import { MessageActions } from "@/model/message.actions";
import MessageRepository, {
  COLLECTION_NAMES,
} from "@/repository/mongo/message";
import { ObjectId } from "mongodb";

export const PrimaryMessageActions: MessageActions = (() => {
  const collection_name = COLLECTION_NAMES.primary;

  return {
    persistMessage: (message: MessageStruct) =>
      MessageRepository.persistMessage(collection_name, message),

    acknowledgeMessages: (message_ids: ObjectId[]) =>
      MessageRepository.removeMessages(collection_name, message_ids),

    readMessages: (user_id: string) =>
      MessageRepository.readMessages(collection_name, user_id),
  };
})();
