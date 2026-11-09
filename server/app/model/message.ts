export type ClientInitialMessagePayload = {
  recipient_id: string;
  caption: string;
  media_uploads: string[];
  client_id: string;
};

export type MessageStruct = ClientInitialMessagePayload & {
  message_uuid: string;
  sender_id: string;
};

export type SentItem = {
  client_id: string;
  message_uuid: string;
  sent_at: string | null;
};

export type DeliveredItem = {
  client_id: string;
  message_uuid: string;
  delivered_at: string | null;
};

export type ReadItem = {
  message_uuid: string;
  read_at: string | null;
};

export type EditedItem = {
  message_uuid: string;
  edited_at: string | null;
  caption: string;
};
