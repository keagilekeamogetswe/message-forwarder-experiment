import { ClientRegistry } from "./client.registry";

// A callback that can be sync or async.
// Used for side-effects like: save to DB, send push, update metrics.
// We allow Promise<void> so callers can do `async () => { await db.save() }`
type SideEffectCallback = () => void | Promise<void>;

/**
 * Creates a sender function for a specific user.
 *
 * NOTE: This does NOT send immediately. It returns a function you have to call:
 *   const send = SendToClient(userId, msg, onSuccess, onFailure);
 *   send(); // <-- actually sends
 *
 * Useful when you want to defer the send, retry it later, or pass it
 * around as a job / queue task.
 *
 * @param userId - Key used to look up the socket in ClientRegistry
 * @param message - Payload to send. Must be JSON-serializable.
 * @param onSuccess - Runs when ws.send() reports no error
 * @param onFailure - Runs when client is missing OR send fails. Optional, defaults to null.
 */
export function CreateMessageDelivery(
  userId: string,
  message: Record<string, unknown>,
  onSuccess: SideEffectCallback,
  onFailure: SideEffectCallback | null = null,
) {
  // Return a thunk so the caller controls WHEN it executes.
  return () => {
    // Look up the live connection for this user.
    const client = ClientRegistry.get(userId);

    // Guard: No socket = user offline / never connected.
    if (!client) {
      // Optional chaining because onFailure can be null.
      // We don't await it - fire and forget. If the caller needs to
      // wait for it, they should await the returned function.
      onFailure?.();
      return;
    }

    // Serialize once, before sending.
    const payload = JSON.stringify(message);

    // Send with Node ws callback.
    // This callback fires on TCP write error, NOT on client ack.
    client.send(payload, (error) => {
      if (error) {
        console.error(error);
        onFailure?.();
        return;
      }

      // Send succeeded (at transport level).
      onSuccess();
    });
  };
}
