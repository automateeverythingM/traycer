import type { ChatRunSettings } from "@traycer/protocol/host/agent/gui/subscribe";

import {
  classifyPrompt,
  ROUTER_TIER_DESCRIPTIONS,
  ROUTER_TIER_LABELS,
  ROUTER_TIERS,
  usableRoute,
  type RouterRoutes,
} from "@/lib/model-router/model-router";

/**
 * Auto-Model for agents that other agents create.
 *
 * Agents create their children inside the host, so the client cannot choose
 * the child's model before it starts. Two things reach it instead:
 *
 * 1. The routing table is written into the user's agent selection guide - the
 *    instructions the host hands an agent when it creates or reconfigures
 *    another one - so the orchestrator picks the tier's model itself.
 * 2. A child that still lands on a model OUTSIDE the table is moved to the
 *    model its name's tier maps to, from its next turn on. A child already on
 *    one of the table's models is left alone: the orchestrator chose it
 *    knowing the whole task, which a name alone cannot tell us.
 */

const GUIDE_BLOCK_START = "<!-- traycer:auto-model:start -->";
const GUIDE_BLOCK_END = "<!-- traycer:auto-model:end -->";

/** The guide section for these routes, or `null` when there is nothing to say. */
export function renderRouterGuideBlock(routes: RouterRoutes): string | null {
  const rows = ROUTER_TIERS.flatMap((tier) => {
    const target = usableRoute(routes[tier]);
    if (target === null) return [];
    const effort =
      target.reasoningEffort.length === 0 ? "default" : target.reasoningEffort;
    return [
      `| ${ROUTER_TIER_LABELS[tier]} | ${ROUTER_TIER_DESCRIPTIONS[tier]} | \`${target.harnessId}\` | \`${target.modelSlug}\` | ${effort} |`,
    ];
  });
  if (rows.length === 0) return null;
  return [
    GUIDE_BLOCK_START,
    "## Auto-Model routing",
    "",
    "When you create or reconfigure an agent, give it the harness, model and reasoning effort for the tier of the task you are handing it. Judge the tier by that agent's own task, not by the overall task. For a tier not listed, choose as you normally would.",
    "",
    "| Tier | Use for | Harness | Model | Reasoning effort |",
    "| --- | --- | --- | --- | --- |",
    ...rows,
    GUIDE_BLOCK_END,
  ].join("\n");
}

/**
 * The guide with the Auto-Model section replaced, added at the end, or removed
 * (`block === null`). Everything outside the markers is the user's and is kept
 * byte for byte.
 */
export function upsertRouterGuideBlock(
  content: string,
  block: string | null,
): string {
  const start = content.indexOf(GUIDE_BLOCK_START);
  const end = content.indexOf(GUIDE_BLOCK_END);
  if (start !== -1 && end > start) {
    const before = content.slice(0, start).replace(/\n+$/, "");
    const after = content
      .slice(end + GUIDE_BLOCK_END.length)
      .replace(/^\n+/, "");
    if (block === null) {
      if (before.length === 0) return after;
      return after.length === 0 ? `${before}\n` : `${before}\n\n${after}`;
    }
    const head = before.length === 0 ? block : `${before}\n\n${block}`;
    return after.length === 0 ? `${head}\n` : `${head}\n\n${after}`;
  }
  if (block === null) return content;
  const trimmed = content.replace(/\s+$/, "");
  return trimmed.length === 0 ? `${block}\n` : `${trimmed}\n\n${block}\n`;
}

export interface SubAgentCandidate {
  readonly title: string;
  readonly parentId: string | null;
  readonly settings: ChatRunSettings | null;
}

/**
 * The settings to move a newly created child agent to, or `null` to leave it.
 */
export function planSubAgentCorrection(
  chat: SubAgentCandidate,
  routes: RouterRoutes,
): ChatRunSettings | null {
  const { settings } = chat;
  if (chat.parentId === null || settings === null) return null;
  const onTable = ROUTER_TIERS.some((tier) => {
    const target = usableRoute(routes[tier]);
    return (
      target !== null &&
      target.harnessId === settings.harnessId &&
      target.modelSlug === settings.model
    );
  });
  if (onTable) return null;
  const target = usableRoute(routes[classifyPrompt(chat.title).tier]);
  if (target === null) return null;
  return {
    ...settings,
    harnessId: target.harnessId,
    model: target.modelSlug,
    reasoningEffort:
      target.reasoningEffort.length === 0 ? null : target.reasoningEffort,
    // Fast mode and the account belong to the model being replaced.
    serviceTier: null,
    profileId: null,
  };
}
