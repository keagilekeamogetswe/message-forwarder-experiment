import { randomUUID } from "node:crypto";
import { ObjectId } from "mongodb";
import GroupParticipants, { type GroupRole } from "@/repository/mongo/groups/group.participants";
import GroupRegistry from "@/repository/mongo/groups/group.registry";
import { UserProgression } from "@/repository/mongo/groups/user.progress";
import MessageRepository, { COLLECTION_NAMES } from "@/repository/mongo/message";
import type { MessageStruct } from "@/model/message";

const INVITE_LIFETIME_MS = 64 * 24 * 60 * 60 * 1000;

function inviteExpired(offset: ObjectId, now = Date.now()): boolean {
  return offset.getTimestamp().getTime() + INVITE_LIFETIME_MS <= now;
}

async function canManageGroup(user_id: string, group_id: ObjectId): Promise<boolean> {
  const participant = await GroupParticipants.getUser(user_id, group_id);
  return participant?.role === "owner" || participant?.role === "admin";
}

export const GroupActions = {
  async getUserGroups(user_id: string) {
    const groups = await UserProgression.getGroups(user_id);
    const records = await Promise.all(groups.map((group_id) => GroupRegistry.getGroup(group_id)));
    return Promise.all(records.filter((group) => group?._id).map(async (group) => {
      const id = group!._id!;
      const participant = await GroupParticipants.getUser(user_id, id);
      return { group_id: id.toHexString(), name: group!.name, role: participant?.role ?? "member" };
    }));
  },

  async createGroup(user_id: string, name: string, context?: string): Promise<ObjectId | null> {
    const group_id = await GroupRegistry.createGroup(user_id, name, randomUUID(), context);
    if (!group_id) return null;
    try {
      if (!(await GroupParticipants.addUser(user_id, group_id, "creator", "owner"))) {
        throw new Error("Could not create group owner membership");
      }
      if (!(await UserProgression.addGroup(user_id, group_id))) {
        throw new Error("Could not create group progression");
      }
      return group_id;
    } catch (error) {
      await GroupParticipants.removeUser(user_id, group_id).catch(() => false);
      await GroupRegistry.deleteGroup(user_id, group_id).catch(() => false);
      throw error;
    }
  },

  async promoteParticipant(actor_id: string, user_id: string, group_id: ObjectId): Promise<boolean> {
    if (!(await canManageGroup(actor_id, group_id))) return false;
    const target = await GroupParticipants.getUser(user_id, group_id);
    if (!target || target.role === "owner" || target.role === "admin") return false;
    return GroupParticipants.updateRole(user_id, "admin", group_id);
  },

  async inviteParticipant(actor_id: string, user_id: string, group_id: ObjectId): Promise<boolean> {
    if (!(await canManageGroup(actor_id, group_id))) return false;
    if (!(await GroupRegistry.getGroup(group_id))) return false;
    if (await UserProgression.hasGroup(user_id, group_id)) return false;
    const offset = ObjectId.createFromTime(Math.floor(Date.now() / 1000));
    return UserProgression.createGroupInvite(user_id, group_id, offset);
  },

  async getInviteCatchup(user_id: string, group_id: ObjectId): Promise<{
    through: ObjectId;
    messages: MessageStruct[];
  } | null> {
    const invite = await UserProgression.getGroupInvite(user_id, group_id);
    if (!invite) return null;
    if (inviteExpired(invite.offset)) {
      await UserProgression.removeGroupInvite(user_id, group_id);
      return null;
    }
    if (!(await GroupRegistry.getGroup(group_id))) {
      await UserProgression.removeGroupInvite(user_id, group_id);
      return null;
    }
    const latest = await MessageRepository.getLatestMessageId(
      COLLECTION_NAMES.group,
      group_id.toHexString(),
    );
    const through = latest && latest.toHexString() > invite.coverage.toHexString()
      ? latest
      : invite.coverage;
    const messages = await MessageRepository.readMessages(
      COLLECTION_NAMES.group,
      group_id.toHexString(),
      {},
      0,
      invite.coverage,
      through,
    );
    return { through, messages };
  },

  async acceptInvite(user_id: string, group_id: ObjectId, through: ObjectId): Promise<boolean> {
    const invite = await UserProgression.getGroupInvite(user_id, group_id);
    if (!invite || inviteExpired(invite.offset)) return false;
    if (!(await GroupParticipants.addUser(user_id, group_id, "invite"))) return false;
    const accepted = await UserProgression.acceptGroupInvite(user_id, group_id, invite, through);
    if (!accepted) await GroupParticipants.removeUser(user_id, group_id);
    return accepted;
  },

  async leaveGroup(user_id: string, group_id: ObjectId): Promise<boolean> {
    const departing = await GroupParticipants.getUser(user_id, group_id);
    if (!departing) return false;
    const members = await GroupParticipants.getGroupUsers(group_id);
    const remaining = members.filter((member) => member.user_id !== user_id);
    const remainingAdmins = remaining.filter((member) => member.role === "admin");
    const remainingMembers = remaining.filter((member) => member.role === "member");
    const successor = departing.role === "owner"
      ? (remainingAdmins[0] ?? remainingMembers[0])
      : departing.role === "admin" && remainingAdmins.length === 0
        ? remainingMembers[0]
        : undefined;

    if (!(await GroupParticipants.removeUser(user_id, group_id))) return false;
    await UserProgression.removeGroup(user_id, group_id);

    if (successor && departing.role === "owner") {
      await GroupParticipants.updateRole(successor.user_id, "owner", group_id);
      await GroupRegistry.update(group_id, { started_by: { user_id: successor.user_id } });
    } else if (successor && departing.role === "admin") {
      await GroupParticipants.updateRole(successor.user_id, "admin", group_id);
    } else if (departing.role === "owner") {
      await GroupRegistry.deleteGroup(user_id, group_id);
    }
    return true;
  },

  async getPendingInvites(user_id: string) {
    const invites = await UserProgression.getGroupInvites(user_id);
    const pending: Array<{ group_id: ObjectId; offset: ObjectId; coverage: ObjectId }> = [];
    for (const [group_id, invite] of invites) {
      if (inviteExpired(invite.offset) || !(await GroupRegistry.getGroup(group_id))) {
        await UserProgression.removeGroupInvite(user_id, group_id);
        continue;
      }
      pending.push({ group_id, ...invite });
    }
    return pending;
  },

  async acknowledgeGroupMessage(user_id: string, group_id: ObjectId, message_id: ObjectId): Promise<boolean> {
    const invite = await UserProgression.getGroupInvite(user_id, group_id);
    if (invite) {
      if (inviteExpired(invite.offset)) {
        await UserProgression.removeGroupInvite(user_id, group_id);
        return false;
      }
      return UserProgression.advanceGroupInviteCoverage(user_id, group_id, message_id);
    }
    if (!(await UserProgression.hasGroup(user_id, group_id))) return false;
    return UserProgression.setGroupMessageCursor(user_id, group_id, message_id);
  },
};

export type { GroupRole };
