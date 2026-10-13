import { describe, expect, it } from "vitest";

import {
  applyRouterToToolbar,
  classifyPrompt,
  decideRoute,
  EMPTY_ROUTER_ROUTES,
  type RoutableToolbar,
  type RouterRoutes,
} from "@/lib/model-router/model-router";

const ROUTES: RouterRoutes = {
  light: {
    harnessId: "opencode",
    modelSlug: "minimax/m3",
    modelLabel: "MiniMax M3",
    reasoningEffort: "",
  },
  standard: {
    harnessId: "opencode",
    modelSlug: "kimi/k3",
    modelLabel: "Kimi K3",
    reasoningEffort: "medium",
  },
  frontier: {
    harnessId: "claude",
    modelSlug: "opus",
    modelLabel: "Opus",
    reasoningEffort: "high",
  },
};

const TOOLBAR: RoutableToolbar = {
  selection: { harnessId: "codex", modelSlug: "gpt-5", profileId: "work" },
  permission: "auto_accept_edits",
  reasoning: "low",
  serviceTier: "priority",
};

describe("classifyPrompt", () => {
  it.each([
    ["Rename this symbol repo-wide", "light"],
    ["Fix the typo in the header", "light"],
    ["Add docstrings to the parser", "light"],
    ["What does this function do?", "light"],
    ["Refactor the billing service", "standard"],
    ["The login test is failing, fix it", "standard"],
    ["Implement a CSV export endpoint", "standard"],
    ["Design a distributed rate limiter", "frontier"],
    ["Find the root cause of the deadlock in the job queue", "frontier"],
    ["Plan the architecture for multi-region sync", "frontier"],
    ["hmm", "standard"],
  ] as const)("%s -> %s", (prompt, tier) => {
    expect(classifyPrompt(prompt).tier).toBe(tier);
  });

  it("treats a long spec as frontier work", () => {
    expect(classifyPrompt("add a button. ".repeat(120)).tier).toBe("frontier");
  });

  it("treats a long checklist as frontier work", () => {
    const steps = ["1. a", "2. b", "3. c", "4. d", "5. e"].join("\n");
    expect(classifyPrompt(steps).tier).toBe("frontier");
  });
});

describe("decideRoute + applyRouterToToolbar", () => {
  it("does nothing while the router is off", () => {
    const decision = decideRoute("Design a system", {
      enabled: false,
      routes: ROUTES,
    });
    expect(decision).toBeNull();
    expect(applyRouterToToolbar(TOOLBAR, decision)).toBe(TOOLBAR);
  });

  it("keeps the composer's pick for an unmapped tier", () => {
    const decision = decideRoute("Rename foo", {
      enabled: true,
      routes: EMPTY_ROUTER_ROUTES,
    });
    expect(decision?.target).toBeNull();
    expect(applyRouterToToolbar(TOOLBAR, decision)).toBe(TOOLBAR);
  });

  it("swaps in the tier's route, keeping permission and dropping account and fast mode", () => {
    const decision = decideRoute("Design a distributed rate limiter", {
      enabled: true,
      routes: ROUTES,
    });
    expect(applyRouterToToolbar(TOOLBAR, decision)).toEqual({
      selection: { harnessId: "claude", modelSlug: "opus", profileId: null },
      permission: "auto_accept_edits",
      reasoning: "high",
      serviceTier: "",
    });
  });
});
