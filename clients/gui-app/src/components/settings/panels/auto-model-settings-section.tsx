/**
 * Docs: see ../SETTINGS.md (Agent selection → Auto-Model).
 * Update that file whenever this settings surface changes.
 */
import { useId, type ReactNode } from "react";
import { X } from "lucide-react";
import {
  guiHarnessIdSchema,
  type GuiHarnessId,
} from "@traycer/protocol/host/agent/shared";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { HarnessIcon } from "@/components/home/pickers/harness-icon";
import {
  modelDisplayLabel,
  type ModelOption,
} from "@/components/home/data/landing-options";
import { harnessLabel } from "@/components/settings/panels/fallback/fallback-harness-label";
import {
  useGuiHarnessModelsQuery,
  useGuiHarnessesQuery,
} from "@/hooks/harnesses/use-gui-harness-catalog";
import {
  ROUTER_TIER_COST,
  ROUTER_TIER_DESCRIPTIONS,
  ROUTER_TIER_LABELS,
  ROUTER_TIERS,
  type RouterTarget,
  type RouterTier,
} from "@/lib/model-router/model-router";
import { useModelRouterStore } from "@/stores/composer/model-router-store";

/** Select value for "the model's own default effort". */
const DEFAULT_EFFORT = "__default__";
const ACTIVE = { enabled: true, subscribed: true } as const;

export function AutoModelSettingsSection(): ReactNode {
  const enabled = useModelRouterStore((state) => state.enabled);
  const setEnabled = useModelRouterStore((state) => state.setEnabled);
  const correctSubAgents = useModelRouterStore(
    (state) => state.correctSubAgents,
  );
  const setCorrectSubAgents = useModelRouterStore(
    (state) => state.setCorrectSubAgents,
  );
  const enabledId = useId();
  const correctId = useId();

  return (
    <section
      aria-labelledby="auto-model-heading"
      className="flex shrink-0 flex-col gap-3 px-5 pt-5"
      data-testid="auto-model-settings"
    >
      <div className="min-w-0">
        <h2
          id="auto-model-heading"
          className="text-ui-md font-semibold text-foreground"
        >
          Auto-Model
        </h2>
        <p className="mt-1 text-ui-xs text-muted-foreground">
          Sends each message to the model that fits the task, so small edits
          don&apos;t cost frontier prices. A tier with no model uses the one you
          pick in the composer.
        </p>
      </div>
      <SwitchRow
        id={enabledId}
        label="Route messages automatically"
        description="Turn on or off from the composer's Auto-Model chip too."
        checked={enabled}
        onCheckedChange={setEnabled}
      />
      <div className="flex min-w-0 flex-col gap-2">
        {ROUTER_TIERS.map((tier) => (
          <TierRow key={tier} tier={tier} />
        ))}
      </div>
      <SwitchRow
        id={correctId}
        label="Apply to agents that agents create"
        description="Adds these routes to the selection instructions below, and moves a new agent to its tier's model before its next message."
        checked={correctSubAgents}
        onCheckedChange={setCorrectSubAgents}
      />
    </section>
  );
}

function SwitchRow(props: {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly checked: boolean;
  readonly onCheckedChange: (next: boolean) => void;
}): ReactNode {
  return (
    <div className="flex min-w-0 items-start justify-between gap-4">
      <label htmlFor={props.id} className="min-w-0">
        <span className="block text-ui-sm text-foreground">{props.label}</span>
        <span className="block text-ui-xs text-muted-foreground">
          {props.description}
        </span>
      </label>
      <Switch
        id={props.id}
        checked={props.checked}
        onCheckedChange={props.onCheckedChange}
      />
    </div>
  );
}

function TierRow(props: { readonly tier: RouterTier }): ReactNode {
  const { tier } = props;
  const target = useModelRouterStore((state) => state.routes[tier]);
  const setRoute = useModelRouterStore((state) => state.setRoute);
  const harnessId: GuiHarnessId | null = target?.harnessId ?? null;
  const modelsQuery = useGuiHarnessModelsQuery(harnessId ?? "codex", null, {
    enabled: harnessId !== null,
    subscribed: harnessId !== null,
  });
  const models: ReadonlyArray<ModelOption> =
    harnessId === null ? [] : (modelsQuery.data?.models ?? []);
  const commit = (next: RouterTarget | null): void => {
    setRoute(tier, next);
  };
  const label = ROUTER_TIER_LABELS[tier];

  return (
    <div
      className="flex min-w-0 flex-col gap-1.5 rounded-md border border-border p-3"
      data-testid={`auto-model-route-${tier}`}
    >
      <div className="flex min-w-0 items-baseline justify-between gap-2">
        <span className="text-ui-sm font-medium text-foreground">
          {label}{" "}
          <span className="font-mono text-ui-xs text-muted-foreground">
            {ROUTER_TIER_COST[tier]}
          </span>
        </span>
        <span className="min-w-0 truncate text-ui-xs text-muted-foreground">
          {ROUTER_TIER_DESCRIPTIONS[tier]}
        </span>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <ProviderSelect label={label} target={target} onCommit={commit} />
        <ModelSelect
          label={label}
          target={target}
          models={models}
          onCommit={commit}
        />
        {target === null ? null : (
          <EffortSelect
            label={label}
            target={target}
            models={models}
            onCommit={commit}
          />
        )}
        {target === null ? null : (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={`Clear ${label} route`}
            onClick={() => {
              commit(null);
            }}
          >
            <X />
          </Button>
        )}
      </div>
    </div>
  );
}

function ProviderSelect(props: {
  readonly label: string;
  readonly target: RouterTarget | null;
  readonly onCommit: (next: RouterTarget | null) => void;
}): ReactNode {
  const { target } = props;
  const harnessesQuery = useGuiHarnessesQuery(ACTIVE);
  const harnesses = (harnessesQuery.data?.harnesses ?? []).filter(
    (harness) => harness.available || harness.id === target?.harnessId,
  );
  return (
    <Select
      value={target?.harnessId ?? ""}
      onValueChange={(next) => {
        const parsed = guiHarnessIdSchema.safeParse(next);
        if (!parsed.success || parsed.data === target?.harnessId) return;
        // A new provider's models are not the old one's; the row stays
        // unmapped until a model is chosen.
        props.onCommit({
          harnessId: parsed.data,
          modelSlug: "",
          modelLabel: "",
          reasoningEffort: "",
        });
      }}
    >
      <SelectTrigger
        size="sm"
        className="max-w-full min-w-0"
        aria-label={`${props.label} provider`}
      >
        <SelectValue placeholder="Provider" />
      </SelectTrigger>
      <SelectContent>
        {harnesses.map((harness) => (
          <SelectItem key={harness.id} value={harness.id}>
            <HarnessIcon harnessId={harness.id} />
            {harnessLabel(harness.id)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ModelSelect(props: {
  readonly label: string;
  readonly target: RouterTarget | null;
  readonly models: ReadonlyArray<ModelOption>;
  readonly onCommit: (next: RouterTarget | null) => void;
}): ReactNode {
  const { target, models } = props;
  return (
    <Select
      value={target?.modelSlug ?? ""}
      disabled={target === null || models.length === 0}
      onValueChange={(slug) => {
        const model = models.find((entry) => entry.slug === slug);
        if (target === null || model === undefined) return;
        props.onCommit({
          harnessId: target.harnessId,
          modelSlug: model.slug,
          modelLabel: modelDisplayLabel(model),
          reasoningEffort: "",
        });
      }}
    >
      <SelectTrigger
        size="sm"
        className="max-w-full min-w-0"
        aria-label={`${props.label} model`}
      >
        <SelectValue
          placeholder={target === null ? "Model" : "Choose a model"}
        />
      </SelectTrigger>
      <SelectContent>
        {models.map((model) => (
          <SelectItem key={model.slug} value={model.slug}>
            {modelDisplayLabel(model)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function EffortSelect(props: {
  readonly label: string;
  readonly target: RouterTarget;
  readonly models: ReadonlyArray<ModelOption>;
  readonly onCommit: (next: RouterTarget | null) => void;
}): ReactNode {
  const { target } = props;
  const model = props.models.find((entry) => entry.slug === target.modelSlug);
  const efforts = model?.supportedReasoningEfforts ?? [];
  if (efforts.length === 0) return null;
  return (
    <Select
      value={
        target.reasoningEffort.length === 0
          ? DEFAULT_EFFORT
          : target.reasoningEffort
      }
      onValueChange={(next) => {
        props.onCommit({
          ...target,
          reasoningEffort: next === DEFAULT_EFFORT ? "" : next,
        });
      }}
    >
      <SelectTrigger
        size="sm"
        className="max-w-full min-w-0"
        aria-label={`${props.label} reasoning effort`}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={DEFAULT_EFFORT}>Default effort</SelectItem>
        {efforts.map((effort) => (
          <SelectItem key={effort.id} value={effort.id}>
            {effort.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
