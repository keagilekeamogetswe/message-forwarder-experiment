import { ObjectId } from "mongodb";
import { WebSocket } from "ws";
import { GroupActions } from "@/actions/group.action";
import GroupRegistry from "@/repository/mongo/groups/group.registry";
import { GroupMessageActions } from "@/actions/message/group.action";
import { CreateMessageForwarder } from "@/websocket/services/message.forwarder";
import type { WSClient } from "@/websocket/types/ws.client";
import type { WSMessage } from "@/websocket/types/ws.router";

function send(user_id: string, action: string, payload: unknown) {
  return CreateMessageForwarder(
    user_id,
    { channel: "group", action, payload },
    () => undefined,
  )();
}

function groupId(value: unknown): ObjectId | null {
  return typeof value === "string" && ObjectId.isValid(value)
    ? new ObjectId(value)
    : null;
}

export const GroupEventHandler = async (data: WSMessage, ws: WSClient) => {
  const user_id = ws.user.user_id;
  const payload = data.payload ?? {};

  try {
    if (data.action === "list") {
      const [groups, invites] = await Promise.all([
        GroupActions.getUserGroups(user_id),
        GroupActions.getPendingInvites(user_id),
      ]);
      const pending_invites = await Promise.all(invites.map(async (invite) => {
        const group = await GroupRegistry.getGroup(invite.group_id);
        return group
          ? { group_id: invite.group_id.toHexString(), name: group.name, offset: invite.offset.toHexString(), coverage: invite.coverage.toHexString() }
          : null;
      }));
      await send(user_id, "list", {
        groups,
        invites: pending_invites.filter((invite) => invite !== null),
      });
      return;
    }

    if (data.action === "create") {
      const name = typeof payload.name === "string" ? payload.name.trim() : "";
      if (!name) return send(user_id, "error", { message: "Enter a group name" });
      const id = await GroupActions.createGroup(user_id, name);
      if (!id) return send(user_id, "error", { message: "Group could not be created" });
      await send(user_id, "created", { group_id: id.toHexString(), name, role: "owner" });
      return;
    }

    if (data.action === "invite") {
      const id = groupId(payload.group_id);
      const invitee_id = typeof payload.user_id === "string" ? payload.user_id.trim() : "";
      if (!id || !invitee_id) return send(user_id, "error", { message: "Choose a group and enter a user ID" });
      const created = await GroupActions.inviteParticipant(user_id, invitee_id, id);
      if (!created) return send(user_id, "error", { message: "Invite could not be created; check your group role and the recipient" });
      const group = await GroupRegistry.getGroup(id);
      await send(invitee_id, "invite_received", { group_id: id.toHexString(), name: group?.name ?? "Group" });
      await send(user_id, "invited", { group_id: id.toHexString(), user_id: invitee_id });
      return;
    }

    if (data.action === "accept") {
      const id = groupId(payload.group_id);
      if (!id) return send(user_id, "error", { message: "Invalid group ID" });
      const catchup = await GroupActions.getInviteCatchup(user_id, id);
      if (!catchup) return send(user_id, "error", { message: "Invite is missing, expired, or the group no longer exists" });
      for (const message of catchup.messages) {
        const delivered = await new Promise<boolean>((resolve) => {
          if (ws.readyState !== WebSocket.OPEN) return resolve(false);
          ws.send(JSON.stringify(message), (error) => resolve(!error));
        });
        if (!delivered || !message._id || !await GroupMessageActions.acknowledgeMessage(user_id, id, message._id)) {
          return send(user_id, "error", { message: "Group catch-up did not finish; the invite is still pending. Retry acceptance when connected." });
        }
      }
      const accepted = await GroupActions.acceptInvite(user_id, id, catchup.through);
      if (!accepted) return send(user_id, "error", { message: "Invite is missing, expired, or could not be accepted" });
      const group = await GroupRegistry.getGroup(id);
      await send(user_id, "accepted", { group_id: id.toHexString(), name: group?.name ?? "Group" });
      return;
    }

    if (data.action === "promote") {
      const id = groupId(payload.group_id);
      const member_id = typeof payload.user_id === "string" ? payload.user_id.trim() : "";
      if (!id || !member_id) return send(user_id, "error", { message: "Choose a group and enter a user ID" });
      const promoted = await GroupActions.promoteParticipant(user_id, member_id, id);
      await send(user_id, promoted ? "promoted" : "error", promoted
        ? { group_id: id.toHexString(), user_id: member_id }
        : { message: "Participant could not be promoted" });
      return;
    }

    await send(user_id, "error", { message: "Unknown group action" });
  } catch (error) {
    console.error("Group websocket action failed:", error);
    await send(user_id, "error", {
      message: error instanceof Error ? error.message : "Group action failed",
    });
  }
};
