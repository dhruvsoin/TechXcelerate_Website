"use client";

import { useEffect, useRef } from "react";
import { EVENTS, isTBA, type RealmEvent } from "@/content/events";
import { LANDMARKS } from "@/content/realm-map";
import { useScroll } from "@/components/scroll/SmoothScroll";
import { realmActions, useRealm } from "./realm-store";
import { playSfx } from "@/components/sound/realm-audio";

/**
 * Registration uses the site's existing registration section. The chosen event is passed
 * along so the registration form (FR-04) can preselect it:
 *  - sessionStorage "txc:preselect-event" = event id
 *  - window event "txc:register" with detail { eventId }
 */
function useRegister() {
  const { scrollTo } = useScroll();
  return (ev: RealmEvent) => (e: React.MouseEvent) => {
    e.preventDefault();
    playSfx("seal");
    try {
      sessionStorage.setItem("txc:preselect-event", ev.id);
    } catch {}
    window.dispatchEvent(new CustomEvent("txc:register", { detail: { eventId: ev.id } }));
    realmActions.closeDetails();
    scrollTo(ev.registerHref);
  };
}

const Value = ({ v }: { v: string }) => (isTBA(v) ? <span className="realm-tba">{v}</span> : <>{v}</>);

/** Compact card shown when the camera arrives at a location, plus the full details panel. */
export default function EventDetailsPanel() {
  const active = useRealm((s) => s.active);
  const arrived = useRealm((s) => s.arrived);
  const open = useRealm((s) => s.detailsOpen);
  const register = useRegister();
  const dialogRef = useRef<HTMLDivElement>(null);
  const ev = active >= 0 ? EVENTS[active] : null;

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.querySelector<HTMLElement>("button, a")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && realmActions.closeDetails();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!ev) return null;
  const place = LANDMARKS[ev.landmark].label;

  return (
    <>
      <section className={`realm-card ${arrived && !open ? "is-visible" : ""}`} aria-live="polite" aria-label={`${ev.name} — ${place}`}>
        <span className="realm-corners" aria-hidden="true" />
        <p className="realm-card-kicker">
          {ev.mode === "online" ? "Online" : "Offline"} · {place}
        </p>
        <h3 className="realm-card-title">{ev.name}</h3>
        <dl className="realm-card-facts">
          <div><dt>When</dt><dd><Value v={ev.dateTime} /></dd></div>
          <div><dt>Where</dt><dd><Value v={ev.venue} /></dd></div>
          <div><dt>Team</dt><dd><Value v={ev.teamSize} /></dd></div>
        </dl>
        <div className="realm-card-actions">
          <a href={ev.registerHref} onClick={register(ev)} className="realm-btn-gold">
            Register Now
          </a>
          <button type="button" className="realm-btn-line" onClick={realmActions.openDetails}>
            Event Details
          </button>
        </div>
      </section>

      {open && (
        <div className="realm-details-backdrop" onClick={realmActions.closeDetails}>
          <div
            ref={dialogRef}
            className="realm-details"
            role="dialog"
            aria-modal="true"
            aria-labelledby="realm-details-title"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="realm-corners" aria-hidden="true" />
            <button type="button" className="realm-back" onClick={realmActions.closeDetails}>
              ← Back to Map
            </button>
            <p className="realm-card-kicker">
              {ev.mode === "online" ? "Online" : "Offline"} competition · {place}
            </p>
            <h3 id="realm-details-title" className="realm-details-title">{ev.name}</h3>
            <p className="realm-details-desc"><Value v={ev.description} /></p>
            <dl className="realm-details-grid">
              <div><dt>Category</dt><dd><Value v={ev.category} /></dd></div>
              <div><dt>Mode</dt><dd>{ev.mode === "online" ? "Online" : "Offline"}{!ev.modeConfirmed && <span className="realm-tba"> (to confirm)</span>}</dd></div>
              <div><dt>Date &amp; time</dt><dd><Value v={ev.dateTime} /></dd></div>
              <div><dt>Venue</dt><dd><Value v={ev.venue} /></dd></div>
              <div><dt>Team size</dt><dd><Value v={ev.teamSize} /></dd></div>
              <div><dt>Fee</dt><dd><Value v={ev.fee} /></dd></div>
            </dl>
            <h4 className="realm-details-sub">Rules &amp; guidelines</h4>
            {ev.rules.length ? (
              <ul className="realm-details-rules">{ev.rules.map((r) => <li key={r}>{r}</li>)}</ul>
            ) : (
              <p className="realm-details-desc"><span className="realm-tba">To be announced</span></p>
            )}
            <div className="realm-card-actions">
              <a href={ev.registerHref} onClick={register(ev)} className="realm-btn-gold">
                Register Now
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
