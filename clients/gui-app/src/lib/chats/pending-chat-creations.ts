/**
 * The creation surfaces' door to the open-epic store's pending-creation
 * registry (`stores/epics/open-epic/pending-chat-creations.ts`).
 *
 * Two free functions rather than a hook, because the surfaces that need them
 * are inside mutation callbacks and command actions, not render bodies - and
 * because the registry is addressed by `epicId`, which every one of those
 * callers already carries on the request it is sending.
 *
 * A NO-OP when the named epic has no live session. That is the honest answer:
 * with nothing projecting that epic there is no table to make the chat visible
 * in, and the create is not a session-lifecycle event.
 */
import { getOpenEpicRegistry } from "@/lib/registries/epic-session-registry";
import type { PendingChatCreation } from "@/stores/epics/open-epic/pending-chat-creations";

export type { PendingChatCreation };

/**
 * Every chat this window asked a host to create, for the life of the window -
 * whether or not the epic had a live session to show it in. Auto-Model's
 * sub-agent watcher reads it to tell a chat the user made (whose model the
 * user picked) from one an agent made.
 */
const createdHere = new Set<string>();

function chatCreationKey(epicId: string, chatId: string): string {
  return `${epicId}\x1f${chatId}`;
}

export function wasChatCreatedHere(epicId: string, chatId: string): boolean {
  return createdHere.has(chatCreationKey(epicId, chatId));
}

/**
 * Show a chat that has just been created, before any record for it exists.
 *
 * Called with the facts of the request that made it, so the row says what was
 * actually asked for - notably `hostId`, which is the host the create was
 * dialled at and NOT whichever host happens to be active.
 */
export function beginPendingChatCreation(
  epicId: string,
  pending: PendingChatCreation,
): void {
  createdHere.add(chatCreationKey(epicId, pending.chatId));
  const handle = getOpenEpicRegistry().get(epicId);
  if (handle === null) return;
  handle.store.getState().beginPendingChatCreation(pending);
}

/**
 * Take it back down: the create failed, so no record will ever arrive to
 * replace it. Idempotent, and safe for a chat that was never registered.
 */
export function clearPendingChatCreation(epicId: string, chatId: string): void {
  const handle = getOpenEpicRegistry().get(epicId);
  if (handle === null) return;
  handle.store.getState().clearPendingChatCreation(chatId);
}
