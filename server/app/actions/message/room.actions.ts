import type { MessageStruct } from "@/model/message";
import MessageRepository, {
  COLLECTION_NAMES,
} from "@/repository/mongo/message";

export const RoomMessageActions = {
  persistMessage(message: MessageStruct): Promise<boolean> {
    return MessageRepository.persistMessage(COLLECTION_NAMES.room, message);
  },
};
