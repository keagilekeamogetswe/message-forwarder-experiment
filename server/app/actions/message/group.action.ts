import { MessageStruct } from "@/model/message";
import { MessageActions } from "@/model/message.actions";
import { GroupProgress } from "@/repository/mongo/groups/user.progress";
import MessageRepository, {
  COLLECTION_NAMES,
} from "@/repository/mongo/message";
import { ObjectId } from "mongodb";

export const GroupMessageActions: MessageActions = (() => {
  const collection_name = COLLECTION_NAMES.group;

  return {
    persistMessage: async (message: MessageStruct) => {
      const group_recipient: ObjectId = new ObjectId(message.recipient_id);
      console.log("type of ", typeof message.recipient_id);
      const is_part_of_group = await GroupProgress.hasGroup(
        message.sender_id,
        group_recipient,
      );

      if (!is_part_of_group) {
        throw new Error("User is not part of the specified group");
      }
      return await MessageRepository.persistMessage(collection_name, message);
    },
    // No acknowlegement for group messages
    // They have a retention policy
    async acknowledgeMessages(
      user_id: string,
      message_ids: ObjectId[],
    ): Promise<number> {
      if (message_ids.length === 0) {
        return 0;
      }

      const latest_message_id = message_ids.reduce((latest, current) =>
        current.toHexString() > latest.toHexString() ? current : latest,
      );

      const updated = await GroupProgress.setLastMessageMesssageID(
        user_id,
        latest_message_id,
      );

      return updated ? message_ids.length : 0;
    },
    // Group has a special kind of read
    async readMessages(user_id: string) {
      const [ignore, limit] = [{}, 0];

      const last_message_id =
        await GroupProgress.getLastMessageMessageID(user_id);

      const group_ids = (await GroupProgress.getGroups(user_id)).map(
        (recipient_id) => recipient_id.toString(),
      );

      if (group_ids.length === 0) {
        return [];
      }
      console.log(group_ids);
      const messages: MessageStruct[] = await MessageRepository.readMessages(
        collection_name,
        group_ids,
        ignore,
        limit,
        last_message_id,
      );
      console.log({ messages });
      return messages;
    },
  };
})();
