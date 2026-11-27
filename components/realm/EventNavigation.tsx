"use client";

import { EVENTS, type EventMode, isTBA } from "@/content/events";
import { realmActions, realmStore, useRealm } from "./realm-store";
import EventIcon from "./EventIcon";

/** Left (online) or right (offline) list of competitions; stays fixed while the camera travels. */
export default function EventNavigation({ mode }: { mode: EventMode }) {
  const active = useRealm((s) => s.active);
  const hover = useRealm((s) => s.hover);
  const discovered = useRealm((s) => s.discovered);
  const items = EVENTS.map((e, i) => ({ e, i })).filter(({ e }) => e.mode === mode);

  return (
    <nav className={`realm-nav realm-nav-${mode}`} aria-label={mode === "online" ? "Online events" : "Offline events"}>
      <p className="realm-nav-title">{mode === "online" ? "Online Events" : "Offline Events"}</p>
      <ol>
        {items.map(({ e, i }) => {
          const state = i === active ? "is-active" : i === hover ? "is-hover" : i < discovered ? "is-found" : "";
          return (
            <li key={e.id} className="realm-nav-item">
              <button
                type="button"
                className={`realm-nav-btn ${state}`}
                aria-current={i === active ? "true" : undefined}
                onClick={() => realmActions.goToEvent(i)}
                onPointerEnter={() => realmStore.set({ hover: i })}
                onPointerLeave={() => realmStore.set({ hover: -1 })}
                onFocus={() => realmStore.set({ hover: i })}
                onBlur={() => realmStore.set({ hover: -1 })}
              >
                <EventIcon landmark={e.landmark} className="realm-nav-icon" />
                <span className="realm-nav-text">
                  <span className="realm-nav-name">{e.name}</span>
                  {!isTBA(e.category) && <span className="realm-nav-cat">{e.category}</span>}
                </span>
                <span className="realm-nav-mark" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
