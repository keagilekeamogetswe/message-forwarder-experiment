"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  MessageDirectoryService,
  type ChatSummary,
  type MessageDirectoryItem,
  type MessageState,
} from "./message.directory";
import { ClientWebsocketDaemon } from "./websocket";

const stateLabels: Record<MessageState, string> = {
  sending: "Sending",
  sent: "Sent",
  delivered: "Delivered",
  read: "Read",
  received: "Received",
  failed: "Failed",
};

function MessageBubble({
  message,
  onReply,
}: {
  message: MessageDirectoryItem;
  onReply: (message: MessageDirectoryItem) => void;
}) {
  const [current, setCurrent] = useState(message);

  useEffect(() => {
    setCurrent(message);
    if (message.state === "read") return;
    return MessageDirectoryService.subscribeToMessageItem(
      message.key,
      setCurrent,
    );
  }, [message.key, message.state]);

  const outgoing = current.direction === "outgoing";

  return (
    <article
      className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm sm:max-w-[72%] ${
        outgoing
          ? "ml-auto rounded-br-sm bg-indigo-600 text-white"
          : "mr-auto rounded-bl-sm border border-slate-200 bg-white text-slate-900"
      }`}
    >
      <p className="whitespace-pre-wrap break-words text-sm leading-6">
        {current.caption || (current.media_uploads.length ? "Attachment" : "")}
      </p>
      {current.media_uploads.map((url) => (
        <a
          className={`mt-2 block break-all text-xs underline ${outgoing ? "text-indigo-100" : "text-indigo-700"}`}
          href={url}
          key={url}
          target="_blank"
          rel="noreferrer"
        >
          {url}
        </a>
      ))}
      {current.reply_to && (
        <p
          className={`mt-2 border-l-2 pl-2 text-xs ${outgoing ? "border-indigo-300 text-indigo-100" : "border-slate-300 text-slate-500"}`}
        >
          Reply to {current.reply_to}
        </p>
      )}
      <div className="mt-2 flex items-center justify-end gap-3 text-[11px] opacity-75">
        {current.message_uuid && (
          <span title={current.message_uuid}>
            {current.message_uuid.slice(0, 8)}
          </span>
        )}
        {outgoing && <span>{stateLabels[current.state]}</span>}
        {current.state === "failed" && <span>Send failed</span>}
        {current.message_uuid && (
          <button
            className="underline underline-offset-2"
            onClick={() => onReply(current)}
            type="button"
          >
            Reply
          </button>
        )}
      </div>
      {current.error && (
        <p className="mt-2 text-xs text-rose-200">{current.error}</p>
      )}
    </article>
  );
}

function ChatListItem({
  chat,
  selected,
  onSelect,
}: {
  chat: ChatSummary;
  selected: boolean;
  onSelect: (chat: ChatSummary) => void;
}) {
  return (
    <button
      className={`w-full rounded-xl px-3 py-3 text-left transition ${selected ? "bg-indigo-50 ring-1 ring-indigo-200" : "hover:bg-slate-50"}`}
      onClick={() => onSelect(chat)}
      type="button"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="truncate font-medium text-slate-900">
          {chat.title}
        </span>
        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase text-slate-500">
          {chat.recipient_type}
        </span>
      </span>
      <span className="mt-1 block truncate text-xs text-slate-500">
        {chat.last_message?.caption ||
          chat.last_message?.media_uploads[0] ||
          "No message text"}
      </span>
    </button>
  );
}

export default function Home() {
  const [userId, setUserId] = useState("");
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState("disconnected");
  const [connectionError, setConnectionError] = useState("");
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [recipient, setRecipient] = useState("");
  const [caption, setCaption] = useState("");
  const [attachmentUrls, setAttachmentUrls] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [clientIdInput, setClientIdInput] = useState("");

  useEffect(() => {
    const refreshChats = () => {
      const nextChats = MessageDirectoryService.getChats();
      setChats(nextChats);
      setSelectedChatId((selected) => selected ?? nextChats[0]?.id ?? null);
    };
    const unsubscribeInbox =
      MessageDirectoryService.subscribeToMessageInbox(refreshChats);
    const unsubscribeMessageEvents =
      MessageDirectoryService.subscribeToMessageEvent(refreshChats);
    const unsubscribeConnection = ClientWebsocketDaemon.on(
      "system",
      "connection",
      (message) => {
        const payload = message.payload as { state?: string } | undefined;
        if (payload?.state) setConnectionState(payload.state);
      },
    );
    const unsubscribeError = ClientWebsocketDaemon.on(
      "system",
      "error",
      (message) => {
        const payload = message.payload as { message?: string } | undefined;
        setConnectionError(payload?.message ?? "WebSocket error");
      },
    );

    return () => {
      unsubscribeInbox();
      unsubscribeMessageEvents();
      unsubscribeConnection();
      unsubscribeError();
    };
  }, []);

  const selectedChat = chats.find((chat) => chat.id === selectedChatId) ?? null;
  const dialogueMessages = useMemo(
    () =>
      selectedChatId ? MessageDirectoryService.getMessages(selectedChatId) : [],
    [chats, selectedChatId],
  );

  useEffect(() => {
    if (!activeUserId || connectionState !== "ready" || !selectedChatId) return;

    for (const message of MessageDirectoryService.getMessages(selectedChatId)) {
      if (
        message.direction !== "incoming" ||
        message.state !== "received" ||
        !message.message_uuid
      ) {
        continue;
      }

      try {
        ClientWebsocketDaemon.send({
          channel: "message_event",
          action: "read_items",
          payload: {
            sender_id: message.sender_id,
            message_ids: [message.message_uuid],
          },
        });
        MessageDirectoryService.updateMessageState(
          message.message_uuid,
          "read",
        );
      } catch {
        // Leave it as received; it will be marked read when the socket is ready.
      }
    }
  }, [activeUserId, connectionState, selectedChatId, chats]);

  function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) return;

    try {
      setConnectionError("");
      MessageDirectoryService.setCurrentUser(normalizedUserId);
      setChats(MessageDirectoryService.getChats());
      setActiveUserId(normalizedUserId);
      ClientWebsocketDaemon.start(normalizedUserId);
    } catch (error) {
      setConnectionError(
        error instanceof Error ? error.message : "Unable to connect",
      );
    }
  }

  function disconnect() {
    ClientWebsocketDaemon.stop();
    setActiveUserId(null);
    setSelectedChatId(null);
    setConnectionState("disconnected");
  }

  function selectChat(chat: ChatSummary) {
    setSelectedChatId(chat.id);
    setRecipient(chat.id);
  }

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeUserId || connectionState !== "ready") return;

    const clientId = clientIdInput.trim() || crypto.randomUUID();
    const mediaUploads = attachmentUrls
      .split(/[\n,]/)
      .map((url) => url.trim())
      .filter(Boolean);
    const payload = {
      recipient_id: recipient.trim(),
      caption,
      media_uploads: mediaUploads,
      client_id: clientId,
      ...(replyTo.trim() ? { reply_to: replyTo.trim() } : {}),
    };

    try {
      MessageDirectoryService.addOutgoingMessage(activeUserId, payload);
      ClientWebsocketDaemon.send({ channel: "chat", action: "send", payload });
      const chatId = recipient.trim();
      setSelectedChatId(chatId);
      setCaption("");
      setAttachmentUrls("");
      setReplyTo("");
      setClientIdInput("");
      setChats(MessageDirectoryService.getChats());
    } catch (error) {
      MessageDirectoryService.updateMessageState(clientId, "failed");
      setConnectionError(
        error instanceof Error ? error.message : "Message could not be sent",
      );
    }
  }

  if (!activeUserId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
        <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/70">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-600">
            WebSocket playground
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            Connect to chat
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Open this page in two separate browsers and connect with a different
            user ID in each.
          </p>
          <form className="mt-7 space-y-4" onSubmit={connect}>
            <label
              className="block text-sm font-medium text-slate-700"
              htmlFor="user-id"
            >
              User ID
              <input
                autoComplete="off"
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                id="user-id"
                onChange={(event) => setUserId(event.target.value)}
                placeholder="alice"
                value={userId}
              />
            </label>
            {connectionError && (
              <p className="text-sm text-rose-600">{connectionError}</p>
            )}
            <button
              className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-medium text-white transition hover:bg-indigo-700"
              type="submit"
            >
              Connect
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-3 text-slate-900 sm:p-6">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-7xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/70 sm:min-h-[calc(100vh-3rem)] sm:flex-row">
        <aside className="flex w-full flex-col border-b border-slate-200 bg-white sm:w-72 sm:shrink-0 sm:border-b-0 sm:border-r lg:w-80">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
                Chat playground
              </p>
              <h1 className="mt-1 truncate text-lg font-semibold">
                {activeUserId}
              </h1>
              <p className="mt-1 text-xs text-slate-500">{connectionState}</p>
            </div>
            <button
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              onClick={disconnect}
              type="button"
            >
              Disconnect
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <h2 className="px-2 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Chats
            </h2>
            {chats.length ? (
              <div className="space-y-1">
                {chats.map((chat) => (
                  <ChatListItem
                    chat={chat}
                    key={chat.id}
                    onSelect={selectChat}
                    selected={chat.id === selectedChatId}
                  />
                ))}
              </div>
            ) : (
              <p className="px-2 py-5 text-sm text-slate-400">
                Messages will create chats here.
              </p>
            )}
          </div>
        </aside>

        <section className="flex min-h-[70vh] min-w-0 flex-1 flex-col sm:min-h-0">
          <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400">
                Dialogue
              </p>
              <h2 className="font-semibold">
                {selectedChat?.id ?? "New message"}
              </h2>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${connectionState === "ready" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
            >
              {connectionState}
            </span>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50/70 p-4 sm:p-6">
            {dialogueMessages.length ? (
              dialogueMessages.map((message) => (
                <MessageBubble
                  key={message.key}
                  message={message}
                  onReply={(item) => setReplyTo(item.message_uuid ?? "")}
                />
              ))
            ) : (
              <div className="flex h-full min-h-40 items-center justify-center text-center text-sm text-slate-400">
                Choose a chat or enter a recipient below to start a dialogue.
              </div>
            )}
          </div>

          <form
            className="space-y-3 border-t border-slate-200 bg-white p-4 sm:p-5"
            onSubmit={sendMessage}
          >
            {connectionError && (
              <p className="text-sm text-rose-600">{connectionError}</p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-slate-600">
                Recipient (@room, #user, $group)
                <input
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  onChange={(event) => setRecipient(event.target.value)}
                  placeholder="#bob"
                  required
                  value={recipient}
                />
              </label>
              <label className="text-xs font-medium text-slate-600">
                Reply to message UUID (optional)
                <input
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  onChange={(event) => setReplyTo(event.target.value)}
                  placeholder="Select Reply or paste a UUID"
                  value={replyTo}
                />
              </label>
              <label className="text-xs font-medium text-slate-600 sm:col-span-2">
                Client message ID (optional)
                <input
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  onChange={(event) => setClientIdInput(event.target.value)}
                  placeholder="Generated automatically if blank"
                  value={clientIdInput}
                />
              </label>
            </div>
            <label className="block text-xs font-medium text-slate-600">
              Message
              <textarea
                className="mt-1.5 min-h-20 w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                onChange={(event) => setCaption(event.target.value)}
                placeholder="Write a message"
                value={caption}
              />
            </label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex-1 text-xs font-medium text-slate-600">
                Attachment URLs (one per line or comma separated)
                <textarea
                  className="mt-1.5 min-h-14 w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  onChange={(event) => setAttachmentUrls(event.target.value)}
                  placeholder="https://example.com/file.jpg"
                  value={attachmentUrls}
                />
              </label>
              <button
                className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                disabled={
                  connectionState !== "ready" ||
                  (!caption.trim() && !attachmentUrls.trim())
                }
                type="submit"
              >
                Send
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
