import { ObjectId } from "mongodb";

export interface GroupRecord {
  _id?: ObjectId;

  created_at: number;

  name: string;

  started_by: {
    user_id: string;
    context?: string;
  };

  invite_token: string;

  active_member_count: number;
}
