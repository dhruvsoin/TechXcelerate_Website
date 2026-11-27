"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { EVENTS } from "@/content/events";
import { LANDMARKS, PATHWAY, REALM_MAP } from "@/content/realm-map";
import { realmActions, realmStore, useRealm } from "./realm-store";
import Raven from "@/components/scroll/scene/Raven";

/** The world layer: map image, golden pathway and markers. Moved by the camera controller. */
export function RealmWorld() {
  // Load the large map only once the page is idle — it is hidden behind the hero at first.
  const [load, setLoad] = useState(false);
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    const id = w.requestIdleCallback ? w.requestIdleCallback(() => setLoad(true)) : window.setTimeout(() => setLoad(true), 600);
    return () => {
      if (!w.requestIdleCallback) clearTimeout(id);
    };
  }, []);

  // Path in a 1600×1000 space (same aspect as the map) so strokes scale evenly; the camera
  // sets --stroke so the line keeps a constant on-screen width at any zoom.
  const d = "M" + PATHWAY.map(([x, y]) => `${(x * 1600).toFixed(1)},${(y * 1000).toFixed(1)}`).join("L");
  return (
    <div className="realm-world" style={{ backgroundImage: `url(${REALM_MAP.blur})` }}>
      {load && (
        // Plain <img> with a width-based srcset: phones get the 3600px map, large screens the 5760px one.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={REALM_MAP.src}
          srcSet={`${REALM_MAP.srcMobile} 3600w, ${REALM_MAP.src} 5760w`}
          sizes="(max-width: 1023px) 220vw, 250vw"
          alt=""
          decoding="async"
          className="realm-world-img"
          draggable={false}
        />
      )}
      <svg className="realm-path" viewBox="0 0 1600 1000" aria-hidden="true">
        <path d={d} className="realm-path-base" />
        <path d={d} className="realm-path-glow" pathLength={1} />
        <path d={d} className="realm-path-live" pathLength={1} />
      </svg>
      {EVENTS.map((e, i) => (
        <EventMarker key={e.id} index={i} />
      ))}
    </div>
  );
}

function EventMarker({ index }: { index: number }) {
  const ev = EVENTS[index];
  const lm = LANDMARKS[ev.landmark];
  const active = useRealm((s) => s.active === index);
  const arrived = useRealm((s) => s.arrived && s.active === index);
  const hover = useRealm((s) => s.hover === index);
  const found = useRealm((s) => index < s.discovered);
  const cls = ["realm-marker", active && "is-active", arrived && "is-arrived", hover && "is-hover", found && "is-found"].filter(Boolean).join(" ");
  return (
    <button
      type="button"
      className={cls}
      style={{ left: `${lm.x * 100}%`, top: `${lm.y * 100}%` }}
      aria-label={`${ev.name} at the ${lm.label}`}
      onClick={() => realmActions.goToEvent(index)}
      onPointerEnter={() => realmStore.set({ hover: index })}
      onPointerLeave={() => realmStore.set({ hover: -1 })}
    >
      <span className="realm-marker-glow" aria-hidden="true" />
      <span className="realm-marker-diamond" aria-hidden="true" />
      <span className="realm-marker-label" aria-hidden="true">
        <span className="realm-marker-name">{ev.name}</span>
        <span className="realm-marker-place">{lm.label}</span>
      </span>
    </button>
  );
}

/** Screen-space atmosphere above the map: drifting clouds, mist, passing light, birds, dust. */
export function AtmosphericEffects() {
  const clouds: [string, React.CSSProperties, string][] = [
    ["puff-2", { left: "4%", top: "8%", width: "26vw", opacity: 0.55 }, "drift-a"],
    ["bank-2", { left: "58%", top: "2%", width: "40vw", opacity: 0.45 }, "drift-b"],
    ["bank-1", { left: "-12%", top: "70%", width: "48vw", opacity: 0.5 }, "drift-b"],
    ["puff-3", { left: "74%", top: "64%", width: "24vw", opacity: 0.5 }, "drift-a"],
  ];
  return (
    <div className="realm-atmos" aria-hidden="true">
      <div className="realm-clouds">
        {clouds.map(([n, style, drift]) => (
          <div key={n} className="absolute lite-hide" style={style}>
            <div className={`cloud-feather ${drift}`}>
              <Image src={`/hero/clouds/${n}.webp`} alt="" width={800} height={300} sizes="40vw" className="h-auto w-full" />
            </div>
          </div>
        ))}
      </div>
      <div className="realm-sunpass" />
      <div className="realm-mist" />
      <Raven className="bird bird-a" />
      <Raven className="bird bird-b lite-hide" />
      <div className="realm-vignette" />
    </div>
  );
}

/** Antique compass rose. */
export function CompassRose({ className = "" }: { className?: string }) {
  const pts = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <svg viewBox="0 0 120 120" className={`realm-compass ${className}`} aria-hidden="true">
      <circle cx="60" cy="60" r="56" fill="none" stroke="currentColor" strokeOpacity=".5" />
      <circle cx="60" cy="60" r="44" fill="none" stroke="currentColor" strokeOpacity=".35" strokeDasharray="1 3" />
      {pts.map((a) => (
        <path key={a} d={a % 90 === 0 ? "M60 8 L66 60 L60 54 L54 60 Z" : "M60 24 L63 60 L60 57 L57 60 Z"} fill={a % 90 === 0 ? "url(#rose-fill)" : "currentColor"} fillOpacity={a % 90 === 0 ? 1 : 0.55} transform={`rotate(${a} 60 60)`} />
      ))}
      <defs>
        <linearGradient id="rose-fill" x1="0" y1="0" x2="1" y2="0">
          <stop offset=".5" stopColor="#F5D8B0" />
          <stop offset=".5" stopColor="#A66A3F" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="4" fill="#326C68" stroke="currentColor" />
      <text x="60" y="6" textAnchor="middle" fontSize="8" fill="currentColor" style={{ fontFamily: "var(--font-cinzel)" }}>N</text>
    </svg>
  );
}

/** Cartographic corner flourishes. */
export function MapOrnaments() {
  const corner = (
    <svg viewBox="0 0 80 80" aria-hidden="true">
      <path d="M2 40 V6 Q2 2 6 2 H40" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M10 30 Q10 10 30 10" fill="none" stroke="currentColor" strokeOpacity=".55" />
      <path d="M2 2 l7 7 m-7 0 l7 -7" stroke="currentColor" strokeOpacity=".6" />
      <circle cx="18" cy="18" r="2.2" fill="#326C68" />
    </svg>
  );
  return (
    <div className="realm-ornaments" aria-hidden="true">
      {["tl", "tr", "bl", "br"].map((c) => (
        <span key={c} className={`realm-corner realm-corner-${c}`}>
          {corner}
        </span>
      ))}
    </div>
  );
}

/** "Location III of X" with a thin progress rule. */
export function RealmProgressIndicator() {
  const active = useRealm((s) => s.active);
  const discovered = useRealm((s) => s.discovered);
  const roman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
  return (
    <div className={`realm-progress ${active >= 0 ? "is-visible" : ""}`} aria-hidden={active < 0}>
      <span>Location {roman[Math.max(0, active)]} of X</span>
      <span className="realm-progress-bar">
        <i style={{ transform: `scaleX(${discovered / EVENTS.length})` }} />
      </span>
    </div>
  );
}

/** Compact event list for small screens (replaces the side panels). */
export function MobileRealmNav() {
  const active = useRealm((s) => s.active);
  const discovered = useRealm((s) => s.discovered);
  useEffect(() => {
    if (active < 0) return;
    document.getElementById(`realm-chip-${active}`)?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [active]);
  return (
    <nav className="realm-mobile-nav" aria-label="Events">
      <ol>
        {EVENTS.map((e, i) => (
          <li key={e.id}>
            <button
              id={`realm-chip-${i}`}
              type="button"
              className={`realm-chip ${i === active ? "is-active" : i < discovered ? "is-found" : ""}`}
              onClick={() => realmActions.goToEvent(i)}
            >
              <span className="realm-chip-mode">{e.mode === "online" ? "Online" : "Offline"}</span>
              {e.name}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
