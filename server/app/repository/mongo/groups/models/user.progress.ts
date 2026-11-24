import type { ObjectId } from "mongodb";

export interface GroupInviteProgress {
  /** ObjectId whose timestamp marks when the invite was requested. */
  offset: ObjectId;
  /** Last group message delivered while acceptance is pending. */
  coverage: ObjectId;
}

export interface UserProgression {
  _id?: ObjectId;
  user_id: string;
  groups: ObjectId[];
  group_message_cursors?: Record<string, ObjectId>;
  group_invites?: Record<string, GroupInviteProgress>;
  /** Kept only to support older repository callers and migration. */
  last_message_id?: ObjectId;
}

// Existing code imports this name; retain it while the collection and model
// now represent all per-user progression state.
export type UserGroupProgress = UserProgression;
