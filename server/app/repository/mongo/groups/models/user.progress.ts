import { ObjectId } from "mongodb";
export interface UserGroupProgress {
  user_id: string; // unique
  last_message_id: ObjectId;
  groups: ObjectId[]; // set semantics, no duplicates
}
