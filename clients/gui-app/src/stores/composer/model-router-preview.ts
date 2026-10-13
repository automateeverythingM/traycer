import { createStore, type StoreApi } from "zustand/vanilla";
import type { JsonContent } from "@traycer/protocol/common/registry";

import { extractPlainTextFromComposerJSONContent } from "@/lib/composer/tiptap-json-content";
import {
  classifyPrompt,
  type RouterClassification,
} from "@/lib/model-router/model-router";
import { useModelRouterStore } from "@/stores/composer/model-router-store";

/**
 * The tier the composer's current draft would route to, for the Auto-Model
 * chip's live preview.
 *
 * One small store per composer, keyed by that composer's toolbar store (which
 * is already one-per-composer and lives exactly as long as it), so two
 * composers on a canvas never show each other's preview. The send path does
 * not read this: it classifies the text it actually sends.
 */
export interface RouterPreviewState {
  /** `null` while the draft is empty. */
  readonly classification: RouterClassification | null;
}

const previews = new WeakMap<object, StoreApi<RouterPreviewState>>();

export function routerPreviewStoreFor(
  owner: object,
): StoreApi<RouterPreviewState> {
  const existing = previews.get(owner);
  if (existing !== undefined) return existing;
  const created = createStore<RouterPreviewState>(() => ({
    classification: null,
  }));
  previews.set(owner, created);
  return created;
}

/** Called from a composer's document-change handler. */
export function noteRouterPreviewContent(
  owner: object,
  content: JsonContent,
): void {
  // Free when the router is off: no text extraction, no classification.
  if (!useModelRouterStore.getState().enabled) return;
  const text = extractPlainTextFromComposerJSONContent(content);
  const store = routerPreviewStoreFor(owner);
  const next = text.trim().length === 0 ? null : classifyPrompt(text);
  const previous = store.getState().classification;
  if (previous?.tier === next?.tier && previous?.reason === next?.reason) {
    return;
  }
  store.setState({ classification: next });
}
