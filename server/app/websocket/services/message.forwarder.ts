import { ClientRegistry } from "./client.registry";

type SideEffectCallback = () => void | Promise<void>;

export function CreateMessageForwarder(
  userId: string,
  message: Record<string, unknown>,
  onSuccess: SideEffectCallback,
  onFailure: SideEffectCallback | null = null,
) {
  // Return a Promise-returning function so callers can await the entire pipeline if needed
  return async (): Promise<void> => {
    const client = ClientRegistry.get(userId);

    if (!client) {
      try {
        await onFailure?.();
      } catch (err) {
        console.error("Error in onFailure callback:", err);
      }
      return;
    }

    const payload = JSON.stringify(message);

    // Wrap client.send in a Promise to bridge the callback-based ws API to async/await
    return new Promise((resolve) => {
      client.send(payload, async (error) => {
        try {
          if (error) {
            console.error(error);
            await onFailure?.();
          } else {
            await onSuccess();
          }
        } catch (err) {
          console.error("Error executing side effect callback:", err);
        } finally {
          resolve();
        }
      });
    });
  };
}
