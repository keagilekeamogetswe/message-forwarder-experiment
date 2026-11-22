import MessageRepository, {
  COLLECTION_NAMES,
} from "@/repository/mongo/message";
import { MessageStruct } from "@/model/message";

export const MessageAction = (() => {
  return {
    room: {
      send: () => {
        MessageRepository.persistMessage();
      },
    },
  };
})();
