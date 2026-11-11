import { ObjectId } from "mongodb";
import { MessageStruct } from "./message";

export interface MessageActions {
  persistMessage: (message: MessageStruct) => Promise<boolean>;

  acknowledgeMessages: (
    user_id: string,
    message_ids: ObjectId[],
  ) => Promise<number>;

  readMessages: (user_id: string) => Promise<MessageStruct[]>;
}
