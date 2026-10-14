import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { invalidateChatRunSettings } from "@/hooks/chats/use-chat-run-settings-query";
import { useHostBinding } from "@/lib/host";
import { resolveNamedHostClient } from "@/lib/host/binding-host-client";
import { appLogger } from "@/lib/logger";
import { planSubAgentCorrection } from "@/lib/model-router/sub-agents";
import { wasChatCreatedHere } from "@/lib/chats/pending-chat-creations";
import { enqueuePersistChatRunSettings } from "@/lib/chats/chat-run-settings-write-queue";
import {
  getEpicSessionHandleHostClient,
  getEpicSessionHandleHostId,
  getOpenEpicRegistry,
} from "@/lib/registries/epic-session-registry";
import { reconcileStoreSubscriptions } from "@/lib/registries/reconcile-store-subscriptions";
import { useModelRouterStore } from "@/stores/composer/model-router-store";
import type { OpenEpicStoreHandle } from "@/stores/epics/open-epic/store";
import type { ChatProjection } from "@/stores/epics/open-epic/types";

/**
 * A chat create's response can land a moment after its record does; waiting
 * this long before judging a new chat lets the "created here" mark arrive.
 */
const SETTLE_MS = 1500;

/**
 * Auto-Model for agents that agents create: when a child chat this window did
 * not create appears in an open epic, move it to its tier's model if it landed
 * on one outside the routing table (see `planSubAgentCorrection`). Chats that
 * existed before the watcher saw the epic are never touched.
 *
 * Renders nothing. Mounted once, app-wide.
 */
export function SubAgentModelRouterBridge(): null {
  const hostBinding = useHostBinding();
  const queryClient = useQueryClient();

  useEffect(() => {
    const registry = getOpenEpicRegistry();
    const subscriptions = new Map<OpenEpicStoreHandle, () => void>();
    const timers = new Set<number>();

    const judge = (handle: OpenEpicStoreHandle, chatId: string): void => {
      const router = useModelRouterStore.getState();
      if (!router.enabled || !router.correctSubAgents) return;
      if (wasChatCreatedHere(handle.epicId, chatId)) return;
      const { chats } = handle.store.getState();
      // Retracted while settling.
      if (!Object.hasOwn(chats.byId, chatId)) return;
      const chat: ChatProjection = chats.byId[chatId];
      const settings = planSubAgentCorrection(chat, router.routes);
      if (settings === null) return;
      const sessionHostId = getEpicSessionHandleHostId(handle);
      const chatHostId = chat.hostId ?? sessionHostId;
      if (chatHostId === null) return;
      const client =
        chatHostId === sessionHostId
          ? getEpicSessionHandleHostClient(handle)
          : resolveNamedHostClient(hostBinding, chatHostId);
      if (client === null) return;
      appLogger.info("[auto-model] moving sub-agent to its tier's model", {
        epicId: handle.epicId,
        chatId,
        from: chat.settings?.model ?? null,
        to: settings.model,
      });
      enqueuePersistChatRunSettings(
        (request) =>
          client
            .request("epic.updateChatRunSettings", request)
            .then((response) => {
              invalidateChatRunSettings(queryClient, chatHostId);
              return response;
            }),
        { epicId: handle.epicId, chatId, settings },
      );
    };

    const watch = (handle: OpenEpicStoreHandle): (() => void) => {
      // Everything already in the epic when the watcher first sees it is
      // history, not a new spawn.
      const seen = new Set<string>(handle.store.getState().chats.allIds);
      return handle.store.subscribe((state, previous) => {
        if (state.chats === previous.chats) return;
        for (const chatId of state.chats.allIds) {
          if (seen.has(chatId)) continue;
          seen.add(chatId);
          if (!Object.hasOwn(state.chats.byId, chatId)) continue;
          if (state.chats.byId[chatId].parentId === null) continue;
          const timer = window.setTimeout(() => {
            timers.delete(timer);
            judge(handle, chatId);
          }, SETTLE_MS);
          timers.add(timer);
        }
      });
    };

    const resync = (): void => {
      reconcileStoreSubscriptions(registry.liveHandles(), subscriptions, watch);
    };
    const unsubscribeRegistry = registry.subscribe(resync);
    resync();
    return () => {
      unsubscribeRegistry();
      for (const unsubscribe of subscriptions.values()) unsubscribe();
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [hostBinding, queryClient]);

  return null;
}
