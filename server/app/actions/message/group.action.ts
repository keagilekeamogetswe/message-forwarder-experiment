import { MessageStruct } from "@/model/message";
import { GroupProgress } from "@/repository/mongo/groups/user.progress";
import MessageRepository, {
  COLLECTION_NAMES,
} from "@/repository/mongo/message";
import { ObjectId } from "mongodb";
import { GroupActions } from "@/actions/group.action";

export const GroupMessageActions = (() => {
  const collection_name = COLLECTION_NAMES.group;

  return {
    persistMessage: async (message: MessageStruct) => {
      if (!ObjectId.isValid(message.recipient_id)) {
        throw new Error("Invalid group recipient ID");
      }

      const group_recipient: ObjectId = new ObjectId(message.recipient_id);
      const is_part_of_group = await GroupProgress.hasGroup(
        message.sender_id,
        group_recipient,
      );

      if (!is_part_of_group) {
        throw new Error("User is not part of the specified group");
      }
      return await MessageRepository.persistMessage(collection_name, message);
    },
    async persistMessages(messages: MessageStruct[]): Promise<Map<string, string | null>> {
      const results = new Map<string, string | null>();
      const validByGroup = new Map<string, MessageStruct[]>();

      for (const message of messages) {
        if (!ObjectId.isValid(message.recipient_id)) {
          results.set(message.message_uuid, "Invalid group recipient ID");
          continue;
        }
        const groupId = new ObjectId(message.recipient_id);
        if (!(await GroupProgress.hasGroup(message.sender_id, groupId))) {
          results.set(message.message_uuid, "User is not part of the specified group");
          continue;
        }
        const groupMessages = validByGroup.get(message.recipient_id) ?? [];
        groupMessages.push(message);
        validByGroup.set(message.recipient_id, groupMessages);
      }

      for (const groupMessages of validByGroup.values()) {
        try {
          const persisted = await MessageRepository.persistMessages(
            collection_name,
            groupMessages,
          );
          if (!persisted) throw new Error("Message could not be persisted");
          for (const message of groupMessages) results.set(message.message_uuid, null);
        } catch {
          for (const message of groupMessages) {
            results.set(message.message_uuid, "Message could not be persisted");
          }
        }
      }
      return results;
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
    async acknowledgeMessage(user_id: string, group_id: ObjectId, message_id: ObjectId): Promise<boolean> {
      return GroupActions.acknowledgeGroupMessage(user_id, group_id, message_id);
    },

    async readMessages(user_id: string) {
      const reads: Promise<MessageStruct[]>[] = [];
      const legacyCursor = await GroupProgress.getLastMessageMessageID(user_id);
      for (const group_id of await GroupProgress.getGroups(user_id)) {
        const cursor = await GroupProgress.getGroupMessageCursor(user_id, group_id);
        reads.push(MessageRepository.readMessages(
          collection_name, group_id.toHexString(), {}, 0, cursor ?? legacyCursor,
        ));
      }
      for (const invite of await GroupActions.getPendingInvites(user_id)) {
        reads.push(MessageRepository.readMessages(
          collection_name, invite.group_id.toHexString(), {}, 0, invite.coverage,
        ));
      }
      const messages = (await Promise.all(reads)).flat();
      const seen = new Set<string>();
      return messages
        .filter((message) => {
          const id = message._id?.toHexString();
          if (!id || seen.has(id)) return false;
          seen.add(id);
          return true;
        })
        .sort((a, b) => (a._id?.toHexString() ?? "").localeCompare(b._id?.toHexString() ?? ""));
    },
  };
})();
