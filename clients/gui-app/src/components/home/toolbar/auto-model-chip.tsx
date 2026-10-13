import { useCallback, type ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { useStore } from "zustand";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HarnessIcon } from "@/components/home/pickers/harness-icon";
import { ToolbarPillButton } from "@/components/home/toolbar/toolbar-buttons";
import { useSystemTabModalActions } from "@/stores/tabs/use-system-tab-modal";
import {
  ROUTER_TIER_COST,
  ROUTER_TIER_LABELS,
  ROUTER_TIERS,
  type RouterTarget,
  type RouterTier,
  usableRoute,
} from "@/lib/model-router/model-router";
import { cn } from "@/lib/utils";
import type { ComposerToolbarStore } from "@/stores/composer/composer-toolbar-store";
import { routerPreviewStoreFor } from "@/stores/composer/model-router-preview";
import { useModelRouterStore } from "@/stores/composer/model-router-store";

/**
 * The composer's Auto-Model switch. While on, the chip names the model the
 * current draft would be sent to, updating as the prompt is typed; the menu
 * shows all three tiers with the one the draft lands on marked.
 */
export function AutoModelChip(props: {
  readonly store: ComposerToolbarStore;
  readonly disabled: boolean;
  readonly runTargetHostId: string | null;
}): ReactNode {
  const enabled = useModelRouterStore((state) => state.enabled);
  const routes = useModelRouterStore((state) => state.routes);
  const setEnabled = useModelRouterStore((state) => state.setEnabled);
  const classification = useStore(
    routerPreviewStoreFor(props.store),
    (state) => state.classification,
  );
  const pickerLabel = useStore(
    props.store,
    (state) => state.selectedModel?.label ?? null,
  );
  const { openSettings } = useSystemTabModalActions();
  const openRoutes = useCallback(() => {
    openSettings({
      section: "agents",
      tab: null,
      draft: null,
      resetToGeneral: false,
      hostId: props.runTargetHostId,
    });
  }, [openSettings, props.runTargetHostId]);

  const activeTier: RouterTier | null = enabled
    ? (classification?.tier ?? null)
    : null;
  const activeTarget =
    activeTier === null ? null : usableRoute(routes[activeTier]);
  const label = chipLabel(activeTier, activeTarget, pickerLabel);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ToolbarPillButton
          aria-label={enabled ? `Auto-Model on: ${label}` : "Auto-Model off"}
          disabled={props.disabled}
          data-testid="auto-model-chip"
          data-state-on={enabled ? "" : undefined}
          className={cn(
            "min-w-0 max-w-[min(32cqw,14rem)]",
            enabled && "border-primary/50 bg-primary/10 text-foreground",
          )}
        >
          {activeTarget === null ? (
            <Sparkles
              className={cn(
                "size-4 shrink-0",
                enabled ? "text-primary" : "text-muted-foreground",
              )}
            />
          ) : (
            <HarnessIcon harnessId={activeTarget.harnessId} />
          )}
          <span className="truncate @max-lg:hidden">{label}</span>
        </ToolbarPillButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[min(90vw,18rem)]">
        <DropdownMenuCheckboxItem
          checked={enabled}
          onCheckedChange={(next) => {
            setEnabled(next);
          }}
        >
          Auto-Model
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Routes by task</DropdownMenuLabel>
        {ROUTER_TIERS.map((tier) => (
          <TierLine
            key={tier}
            tier={tier}
            target={usableRoute(routes[tier])}
            current={tier === activeTier}
            enabled={enabled}
          />
        ))}
        {enabled && classification !== null ? (
          <p className="px-2 pt-1 text-ui-xs text-muted-foreground">
            Picked for this draft: {classification.reason}
          </p>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={openRoutes}>Edit routes…</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function chipLabel(
  tier: RouterTier | null,
  target: RouterTarget | null,
  pickerLabel: string | null,
): string {
  if (tier === null) return "Auto-Model";
  const modelName = target?.modelLabel ?? pickerLabel ?? "Picker";
  return `${modelName} · ${ROUTER_TIER_COST[tier]}`;
}

function TierLine(props: {
  readonly tier: RouterTier;
  readonly target: RouterTarget | null;
  readonly current: boolean;
  readonly enabled: boolean;
}): ReactNode {
  const { tier, target, current } = props;
  return (
    <div
      data-testid={`auto-model-tier-${tier}`}
      data-current={current ? "" : undefined}
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-sm px-2 py-1.5 text-ui-sm",
        current ? "bg-primary/10 text-foreground" : "text-muted-foreground",
        !props.enabled && "opacity-60",
      )}
    >
      <span className="w-16 shrink-0 font-medium">
        {ROUTER_TIER_LABELS[tier]}
      </span>
      {target === null ? (
        <span className="min-w-0 flex-1 truncate">The model you pick</span>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          <HarnessIcon harnessId={target.harnessId} />
          <span className="truncate">{target.modelLabel}</span>
        </span>
      )}
      <span className="shrink-0 font-mono text-ui-xs">
        {ROUTER_TIER_COST[tier]}
      </span>
    </div>
  );
}
