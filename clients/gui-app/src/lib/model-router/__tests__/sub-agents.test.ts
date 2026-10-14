import { describe, expect, it } from "vitest";
import type { ChatRunSettings } from "@traycer/protocol/host/agent/gui/subscribe";

import {
  EMPTY_ROUTER_ROUTES,
  type RouterRoutes,
} from "@/lib/model-router/model-router";
import {
  planSubAgentCorrection,
  renderRouterGuideBlock,
  upsertRouterGuideBlock,
} from "@/lib/model-router/sub-agents";

const ROUTES: RouterRoutes = {
  light: {
    harnessId: "opencode",
    modelSlug: "minimax/m3",
    modelLabel: "MiniMax M3",
    reasoningEffort: "",
  },
  standard: null,
  frontier: {
    harnessId: "claude",
    modelSlug: "opus",
    modelLabel: "Opus",
    reasoningEffort: "high",
  },
};

const CHILD_SETTINGS: ChatRunSettings = {
  harnessId: "codex",
  model: "gpt-5",
  permissionMode: "full_access",
  reasoningEffort: "medium",
  serviceTier: "priority",
  agentMode: "regular",
  profileId: "work",
};

describe("renderRouterGuideBlock", () => {
  it("lists only mapped tiers", () => {
    const block = renderRouterGuideBlock(ROUTES);
    expect(block).toContain("| Light |");
    expect(block).toContain("`minimax/m3` | default |");
    expect(block).toContain("`opus` | high |");
    expect(block).not.toContain("| Standard |");
  });

  it("says nothing when no tier is mapped", () => {
    expect(renderRouterGuideBlock(EMPTY_ROUTER_ROUTES)).toBeNull();
  });
});

describe("upsertRouterGuideBlock", () => {
  const block = renderRouterGuideBlock(ROUTES) ?? "";

  it("appends to the user's guide, then replaces in place", () => {
    const appended = upsertRouterGuideBlock("# Mine\n\nUse Codex.\n", block);
    expect(appended).toBe(`# Mine\n\nUse Codex.\n\n${block}\n`);
    const withTail = `${appended}\nMore rules.\n`;
    const replaced = upsertRouterGuideBlock(
      withTail,
      "<!-- traycer:auto-model:start -->\nX\n<!-- traycer:auto-model:end -->",
    );
    expect(replaced).toBe(
      "# Mine\n\nUse Codex.\n\n<!-- traycer:auto-model:start -->\nX\n<!-- traycer:auto-model:end -->\n\nMore rules.\n",
    );
  });

  it("removes the block and keeps the rest", () => {
    const appended = upsertRouterGuideBlock("# Mine\n", block);
    expect(upsertRouterGuideBlock(appended, null)).toBe("# Mine\n");
  });

  it("is a no-op when there is nothing to remove or change", () => {
    expect(upsertRouterGuideBlock("# Mine\n", null)).toBe("# Mine\n");
    const appended = upsertRouterGuideBlock("# Mine\n", block);
    expect(upsertRouterGuideBlock(appended, block)).toBe(appended);
  });
});

describe("planSubAgentCorrection", () => {
  it("moves a child off a model outside the table, by its name's tier", () => {
    expect(
      planSubAgentCorrection(
        {
          title: "Design the distributed cache",
          parentId: "parent",
          settings: CHILD_SETTINGS,
        },
        ROUTES,
      ),
    ).toEqual({
      ...CHILD_SETTINGS,
      harnessId: "claude",
      model: "opus",
      reasoningEffort: "high",
      serviceTier: null,
      profileId: null,
    });
  });

  it("leaves a child the orchestrator already put on a table model", () => {
    expect(
      planSubAgentCorrection(
        {
          title: "Design the distributed cache",
          parentId: "parent",
          settings: {
            ...CHILD_SETTINGS,
            harnessId: "opencode",
            model: "minimax/m3",
          },
        },
        ROUTES,
      ),
    ).toBeNull();
  });

  it("leaves top-level chats, unset settings and unmapped tiers alone", () => {
    const base = { title: "Rename foo", settings: CHILD_SETTINGS };
    expect(
      planSubAgentCorrection({ ...base, parentId: null }, ROUTES),
    ).toBeNull();
    expect(
      planSubAgentCorrection(
        { ...base, parentId: "p", settings: null },
        ROUTES,
      ),
    ).toBeNull();
    expect(
      planSubAgentCorrection(
        { title: "Refactor billing", parentId: "p", settings: CHILD_SETTINGS },
        ROUTES,
      ),
    ).toBeNull();
  });
});
