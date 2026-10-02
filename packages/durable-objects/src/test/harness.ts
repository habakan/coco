import { env, runInDurableObject } from 'cloudflare:test';
import { it as vitestIt } from 'vitest';

let currentStorage: DurableObjectStorage | undefined;

/** Storage of the Durable Object the current test body runs in. */
export function storage(): DurableObjectStorage {
  if (!currentStorage) throw new Error('storage() called outside a Durable Object test');
  return currentStorage;
}

// Durable Object storage only works inside that object, so each test body runs in a fresh one.
export function it(name: string, fn: () => unknown, timeout?: number): void {
  vitestIt(
    name,
    async () => {
      const stub = env.WALLET.get(env.WALLET.newUniqueId());
      await runInDurableObject(stub, async (_instance, state) => {
        currentStorage = state.storage;
        try {
          await fn();
        } finally {
          currentStorage = undefined;
        }
      });
    },
    timeout,
  );
}
