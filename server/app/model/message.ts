import type { ObjectId } from "mongodb";

export type ClientInitialMessagePayload = {
  recipient_id: string;
  caption: string;
  media_uploads: string[];
  client_id: string;
  reply_to?: string;
};

export type ClientBulkMessagePayload = {
  recipients: string[];
  caption: string;
  media_uploads: string[];
  client_id: string;
  reply_to?: string;
};

export type MessageRecipientType = "room" | "primary" | "group";

export type ClientReadItemsPayload = {
  sender_id: string;
  message_ids: string[];
};

export type MessageStruct = ClientInitialMessagePayload & {
  _id?: ObjectId;
  message_uuid: string;
  sender_id: string;
  recipient_type?: MessageRecipientType;
  bulk_id?: string;
};

export type BulkSendResult = {
  recipient: string;
  status: "sent" | "failed";
  message_uuid?: string;
  error?: string;
};

export type SentItem = {
  client_id: string;
  message_uuid: string;
  sent_at: string | null;
};

export type DeliveredItem = {
  client_id: string;
  sender_id: string;
  recipient_id: string;
  message_uuid: string;
  delivered_at: string | null;
};

export type ReadItem = {
  recipient_id: string;
  message_uuid: string;
  read_at: string | null;
};

export type EditedItem = {
  message_uuid: string;
  edited_at: string | null;
  caption: string;
};
