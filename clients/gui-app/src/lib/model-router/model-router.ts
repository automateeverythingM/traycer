import type {
  HarnessModelSelection,
  PermissionMode,
  ProviderId,
  ReasoningLevel,
  ServiceTier,
} from "@/components/home/data/landing-options";

/**
 * Auto-Model: picks the model for a turn from what the prompt asks for.
 *
 * Three tiers, cheapest first. The user maps each tier to a concrete
 * (provider, model, effort) in Settings; a tier left unmapped falls back to
 * whatever the composer's own picker shows, so a half-configured router never
 * blocks a send.
 *
 * Classification is deterministic keyword + shape scoring. It runs on every
 * keystroke for the composer's live preview, so it must stay cheap and pure.
 */

export const ROUTER_TIERS = ["light", "standard", "frontier"] as const;
export type RouterTier = (typeof ROUTER_TIERS)[number];

export const ROUTER_TIER_LABELS: Readonly<Record<RouterTier, string>> = {
  light: "Light",
  standard: "Standard",
  frontier: "Frontier",
};

/** Relative cost marker shown next to each tier. */
export const ROUTER_TIER_COST: Readonly<Record<RouterTier, string>> = {
  light: "$",
  standard: "$$",
  frontier: "$$$",
};

export const ROUTER_TIER_DESCRIPTIONS: Readonly<Record<RouterTier, string>> = {
  light: "Renames, small edits, formatting, quick questions.",
  standard: "Bug fixes, refactors, tests, ordinary features.",
  frontier: "Design, architecture, hard debugging, large multi-step work.",
};

export interface RouterTarget {
  readonly harnessId: ProviderId;
  readonly modelSlug: string;
  /** The catalog's display label at pick time, for chips and the guide. */
  readonly modelLabel: string;
  /** `""` = the model's own default effort. */
  readonly reasoningEffort: ReasoningLevel;
}

export type RouterRoutes = Readonly<Record<RouterTier, RouterTarget | null>>;

export const EMPTY_ROUTER_ROUTES: RouterRoutes = {
  light: null,
  standard: null,
  frontier: null,
};

export interface RouterClassification {
  readonly tier: RouterTier;
  /** Short human-readable cue the tier was chosen on, e.g. `"rename"`. */
  readonly reason: string;
}

interface Signal {
  readonly pattern: RegExp;
  readonly cue: string;
}

const LIGHT_SIGNALS: ReadonlyArray<Signal> = [
  { pattern: /\brenam(e|ing)\b/, cue: "rename" },
  { pattern: /\btypos?\b/, cue: "typo" },
  { pattern: /\b(format|reformat|prettier|lint)\b/, cue: "formatting" },
  { pattern: /\b(docstrings?|jsdoc|comments?)\b/, cue: "comments" },
  { pattern: /\btype hints?\b/, cue: "type hints" },
  {
    pattern: /\b(bump|upgrade) (the )?(version|dependency|deps?)\b/,
    cue: "bump",
  },
  { pattern: /\b(sort|organi[sz]e) imports?\b/, cue: "imports" },
  { pattern: /\b(remove|delete) (unused|dead)\b/, cue: "cleanup" },
  {
    pattern: /\b(what is|what does|where is|explain|summari[sz]e)\b/,
    cue: "question",
  },
  { pattern: /\bhello world\b/, cue: "trivial" },
  {
    pattern: /\b(one[- ]line|small|tiny|quick|simple|trivial)\b/,
    cue: "small",
  },
  {
    pattern: /\b(update|fix) (the )?(readme|changelog|copy|wording|label)\b/,
    cue: "copy",
  },
];

const STANDARD_SIGNALS: ReadonlyArray<Signal> = [
  { pattern: /\brefactor/, cue: "refactor" },
  {
    pattern: /\b(fix|bug|broken|failing|fails|crash|error|exception)\b/,
    cue: "bug fix",
  },
  { pattern: /\b(debug|investigate|diagnose)\b/, cue: "debugging" },
  {
    pattern: /\b(add|write|update) (a |the |unit |more )?tests?\b/,
    cue: "tests",
  },
  {
    pattern: /\b(implement|add|build|create) (a |an |the )?\w+/,
    cue: "feature",
  },
  { pattern: /\b(endpoint|component|hook|migration|query)\b/, cue: "feature" },
];

const FRONTIER_SIGNALS: ReadonlyArray<Signal> = [
  {
    pattern: /\b(design|architect|architecture|system design)\b/,
    cue: "design",
  },
  { pattern: /\bdistributed\b/, cue: "distributed" },
  {
    pattern: /\b(concurrency|race condition|deadlock|consistency)\b/,
    cue: "concurrency",
  },
  { pattern: /\b(from scratch|greenfield|rewrite)\b/, cue: "rewrite" },
  { pattern: /\b(security|vulnerabilit|threat model|audit)/, cue: "security" },
  {
    pattern: /\b(performance|optimi[sz]e|scalab|latency|throughput)/,
    cue: "performance",
  },
  { pattern: /\b(root cause|post-?mortem)\b/, cue: "root cause" },
  { pattern: /\b(plan|strategy|trade-?offs?|proposal|rfc)\b/, cue: "planning" },
  {
    pattern:
      /\b(end[- ]to[- ]end|across the (codebase|repo)|whole (codebase|repo|app))\b/,
    cue: "codebase-wide",
  },
  { pattern: /\b(orchestrat|sub-?agents?|delegate)/, cue: "orchestration" },
];

/** A prompt this long is a spec, not a one-liner. */
const LONG_PROMPT_CHARS = 1200;
const MEDIUM_PROMPT_CHARS = 400;

function matches(
  text: string,
  signals: ReadonlyArray<Signal>,
): ReadonlyArray<string> {
  const cues: string[] = [];
  for (const signal of signals) {
    if (signal.pattern.test(text) && !cues.includes(signal.cue)) {
      cues.push(signal.cue);
    }
  }
  return cues;
}

function countListItems(text: string): number {
  return text.split("\n").filter((line) => /^\s*(\d+[.)]|[-*•])\s+/.test(line))
    .length;
}

export function classifyPrompt(prompt: string): RouterClassification {
  const text = prompt.toLowerCase();
  const trimmedLength = text.trim().length;
  const frontier = matches(text, FRONTIER_SIGNALS);
  const standard = matches(text, STANDARD_SIGNALS);
  const light = matches(text, LIGHT_SIGNALS);
  const listItems = countListItems(prompt);

  if (trimmedLength >= LONG_PROMPT_CHARS) {
    return { tier: "frontier", reason: "long spec" };
  }
  if (listItems >= 5) {
    return { tier: "frontier", reason: "multi-step" };
  }
  if (frontier.length >= 2) {
    return { tier: "frontier", reason: frontier.slice(0, 2).join(" + ") };
  }
  // One frontier cue wins over a feature/bug cue, but a light cue alongside it
  // ("explain the architecture") keeps it out of the most expensive tier.
  if (frontier.length === 1 && light.length === 0) {
    return { tier: "frontier", reason: frontier[0] };
  }
  // A short prompt with at least as many small-edit cues as feature/bug cues
  // ("fix the typo", "add a small helper") is a light edit.
  if (
    light.length > 0 &&
    light.length >= standard.length &&
    trimmedLength < MEDIUM_PROMPT_CHARS
  ) {
    return { tier: "light", reason: light[0] };
  }
  if (standard.length > 0) {
    return { tier: "standard", reason: standard[0] };
  }
  if (light.length > 0) {
    return { tier: "light", reason: light[0] };
  }
  if (frontier.length > 0) {
    return { tier: "standard", reason: frontier[0] };
  }
  return { tier: "standard", reason: "default" };
}

/** The four toolbar values a send turns into `ChatRunSettings`. */
export interface RoutableToolbar {
  readonly selection: HarnessModelSelection;
  readonly permission: PermissionMode;
  readonly reasoning: ReasoningLevel;
  readonly serviceTier: ServiceTier;
}

export interface RouterDecision {
  readonly classification: RouterClassification;
  /** `null` when the tier is unmapped and the composer's own pick is used. */
  readonly target: RouterTarget | null;
}

export interface RouterConfig {
  readonly enabled: boolean;
  readonly routes: RouterRoutes;
}

/** A row whose provider is picked but whose model is not yet is unmapped. */
export function usableRoute(target: RouterTarget | null): RouterTarget | null {
  return target === null || target.modelSlug.length === 0 ? null : target;
}

export function decideRoute(
  prompt: string,
  config: RouterConfig,
): RouterDecision | null {
  if (!config.enabled) return null;
  const classification = classifyPrompt(prompt);
  return {
    classification,
    target: usableRoute(config.routes[classification.tier]),
  };
}

/**
 * The toolbar values a send should use. Unchanged when the router is off or
 * the prompt's tier has no route. Permission rides through: it is the user's
 * standing choice, not a property of the model.
 */
export function applyRouterToToolbar(
  toolbar: RoutableToolbar,
  decision: RouterDecision | null,
): RoutableToolbar {
  if (decision === null || decision.target === null) return toolbar;
  const { target } = decision;
  return {
    selection: {
      harnessId: target.harnessId,
      modelSlug: target.modelSlug,
      // A route names no account; the provider's ambient login runs it.
      profileId: null,
    },
    permission: toolbar.permission,
    reasoning: target.reasoningEffort,
    // Fast mode is a per-model upgrade; a tier switch must not carry it.
    serviceTier: "",
  };
}
