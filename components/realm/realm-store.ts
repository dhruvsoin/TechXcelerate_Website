"use client";

import { useSyncExternalStore } from "react";

/**
 * Tiny shared state for the realm. Scroll updates write here only when something
 * actually changes (active event, arrival, discoveries), so React re-renders stay rare.
 */
export type RealmStage = "hero" | "fade" | "map" | "travel" | "finale";
export type RealmState = {
  stage: RealmStage;
  /** Index into EVENTS of the event being travelled to / shown, or -1. */
  active: number;
  /** True once the camera has arrived at the active event. */
  arrived: boolean;
  /** Number of events discovered so far (in route order). */
  discovered: number;
  /** Event under the pointer (marker or nav item), or -1. */
  hover: number;
  detailsOpen: boolean;
};

let state: RealmState = { stage: "hero", active: -1, arrived: false, discovered: 0, hover: -1, detailsOpen: false };
const listeners = new Set<() => void>();

export const realmStore = {
  get: () => state,
  set(patch: Partial<RealmState>) {
    let changed = false;
    for (const k in patch) {
      const key = k as keyof RealmState;
      if (state[key] !== patch[key]) changed = true;
    }
    if (!changed) return;
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

const serverState = state;
export function useRealm<T>(select: (s: RealmState) => T): T {
  return useSyncExternalStore(realmStore.subscribe, () => select(state), () => select(serverState));
}

/** Actions are provided by the experience once its timeline exists. */
export const realmActions = {
  goToEvent: (i: number) => {
    void i;
  },
  openDetails: () => realmStore.set({ detailsOpen: true }),
  closeDetails: () => realmStore.set({ detailsOpen: false }),
};
