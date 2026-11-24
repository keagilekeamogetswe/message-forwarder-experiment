import { ObjectId } from "mongodb";
import GroupParticipants from "../group.participants";

export interface GroupParticipants {
  _id?: ObjectId;

  group_id: ObjectId;

  user_id: string;

  role: "owner" | "admin" | "member";

  joined_at: number;

  join_method: "creator" | "invite" | "added";
}

export interface GroupParticipantsArchive {
  _id?: ObjectId;

  group_id: ObjectId;

  user_id: string;

  role: string;

  joined_at: number;

  join_method: string;

  left_at: number;
}
