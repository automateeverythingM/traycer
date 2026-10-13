import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  EMPTY_ROUTER_ROUTES,
  type RouterConfig,
  type RouterRoutes,
  type RouterTarget,
  type RouterTier,
} from "@/lib/model-router/model-router";
import { basePersistOptions, persistKey, STORE_KEYS } from "@/lib/persist";

/**
 * Auto-Model settings: whether the router is on, and which model each tier
 * runs on. Read at send time by the composers and by the sub-agent watcher.
 */
interface ModelRouterStore extends RouterConfig {
  /**
   * Re-assign the model of agents that other agents create, when it is not
   * the one their task's tier maps to.
   */
  readonly correctSubAgents: boolean;
  readonly setEnabled: (enabled: boolean) => void;
  readonly setRoute: (tier: RouterTier, target: RouterTarget | null) => void;
  readonly setCorrectSubAgents: (enabled: boolean) => void;
  readonly resetForTests: () => void;
}

export const useModelRouterStore = create<ModelRouterStore>()(
  persist(
    (set) => ({
      enabled: false,
      routes: EMPTY_ROUTER_ROUTES,
      correctSubAgents: true,
      setEnabled: (enabled) => {
        set({ enabled });
      },
      setRoute: (tier, target) => {
        set((state) => {
          const routes: RouterRoutes = { ...state.routes, [tier]: target };
          return { routes };
        });
      },
      setCorrectSubAgents: (correctSubAgents) => {
        set({ correctSubAgents });
      },
      resetForTests: () => {
        set({
          enabled: false,
          routes: EMPTY_ROUTER_ROUTES,
          correctSubAgents: true,
        });
      },
    }),
    {
      ...basePersistOptions(persistKey(STORE_KEYS.modelRouter)),
      partialize: (state) => ({
        enabled: state.enabled,
        routes: state.routes,
        correctSubAgents: state.correctSubAgents,
      }),
    },
  ),
);

/** A plain snapshot for submit paths, which read stores outside React. */
export function readModelRouterConfig(): RouterConfig {
  const { enabled, routes } = useModelRouterStore.getState();
  return { enabled, routes };
}
