"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { EVENTS } from "@/content/events";
import { LANDMARKS, PATHWAY, REALM_MAP } from "@/content/realm-map";
import { realmActions, realmCamera, realmStore, useRealm } from "./realm-store";
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
        <span className="realm-title-rule" />
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
const MAP_RATIO = REALM_MAP.width / REALM_MAP.height;
const shortest = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;

/**
 * A live compass. The rose stays fixed to the map (north up); a magnetic needle above it points
 * where the journey is heading — north over the overview, the event being flown to while
 * travelling, and the next stop once you've arrived. The needle runs on a damped spring, so it
 * swings past, wobbles and settles like a real one, with a faint tremble at rest. A glint circles
 * the brass ring and a ripple runs out on each arrival. Static (needle north) for reduced motion.
 */
export function CompassRose({ className = "" }: { className?: string }) {
  const pts = [0, 45, 90, 135, 180, 225, 270, 315];
  const ticks = Array.from({ length: 36 }, (_, i) => i * 10);
  const svg = useRef<SVGSVGElement>(null);
  const needle = useRef<SVGGElement>(null);
  const arrivals = useRealm((s) => (s.arrived ? s.active : -1));

  useEffect(() => {
    const el = svg.current, n = needle.current;
    if (!el || !n || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let angle = 0, vel = 0, raf = 0, last = performance.now(), visible = false;

    const bearing = () => {
      const { active, arrived } = realmStore.get();
      if (active < 0) return 0; // overview: true north
      const i = arrived ? Math.min(active + 1, EVENTS.length - 1) : active;
      if (arrived && i === active) return 0; // last stop reached
      const lm = LANDMARKS[EVENTS[i].landmark];
      const dx = (lm.gx - realmCamera.u) * MAP_RATIO, dy = lm.gy - realmCamera.v;
      if (Math.hypot(dx, dy) < 0.004) return angle; // right on top of it: hold
      return (Math.atan2(dx, -dy) * 180) / Math.PI;
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!visible || document.hidden) return;
      const t = now / 1000;
      const tremble = Math.sin(t * 0.9) * 2.2 + Math.sin(t * 2.3 + 1) * 0.9; // a needle is never quite still
      const diff = shortest(bearing() + tremble - angle);
      vel += (diff * 38 - vel * 5.2) * dt; // underdamped spring: swings past, then settles
      angle += vel * dt;
      n.setAttribute("transform", `rotate(${angle.toFixed(2)} 60 60)`);
    };

    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting && el.getClientRects().length > 0));
    io.observe(el);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, []);

  return (
    <svg ref={svg} viewBox="0 0 120 120" className={`realm-compass ${className}`} aria-hidden="true">
      <defs>
        <linearGradient id="rose-fill" x1="0" y1="0" x2="1" y2="0">
          <stop offset=".5" stopColor="#F5D8B0" />
          <stop offset=".5" stopColor="#A66A3F" />
        </linearGradient>
        <linearGradient id="needle-n" x1="0" y1="0" x2="1" y2="0">
          <stop offset=".5" stopColor="#FFE3B8" />
          <stop offset=".5" stopColor="#D49560" />
        </linearGradient>
        <linearGradient id="needle-s" x1="0" y1="0" x2="1" y2="0">
          <stop offset=".5" stopColor="#5E9C93" />
          <stop offset=".5" stopColor="#2B5A56" />
        </linearGradient>
        <radialGradient id="compass-glass" cx=".38" cy=".32" r=".7">
          <stop offset="0" stopColor="#F5D8B0" stopOpacity=".16" />
          <stop offset=".55" stopColor="#F5D8B0" stopOpacity=".03" />
          <stop offset="1" stopColor="#F5D8B0" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* brass ring with degree ticks */}
      <circle cx="60" cy="60" r="56" fill="none" stroke="currentColor" strokeOpacity=".5" />
      {ticks.map((a) => (
        <line key={a} x1="60" y1={a % 90 === 0 ? 5.5 : 6.5} x2="60" y2="9" stroke="currentColor" strokeOpacity={a % 90 === 0 ? 0.8 : 0.35} strokeWidth=".6" transform={`rotate(${a} 60 60)`} />
      ))}
      <g className="compass-glint">
        <circle cx="60" cy="60" r="56" fill="none" stroke="#FFE9C4" strokeWidth="1.4" strokeLinecap="round" strokeDasharray="16 336" />
      </g>
      <circle cx="60" cy="60" r="44" fill="none" stroke="currentColor" strokeOpacity=".35" strokeDasharray="1 3" />

      {/* the fixed rose, a little quieter so the needle reads first */}
      <g opacity=".62">
        {pts.map((a) => (
          <path key={a} d={a % 90 === 0 ? "M60 8 L66 60 L60 54 L54 60 Z" : "M60 24 L63 60 L60 57 L57 60 Z"} fill={a % 90 === 0 ? "url(#rose-fill)" : "currentColor"} fillOpacity={a % 90 === 0 ? 1 : 0.55} transform={`rotate(${a} 60 60)`} />
        ))}
      </g>

      {/* arrival ripple (re-keyed so it replays at every stop) */}
      {arrivals >= 0 && <circle key={arrivals} className="compass-ripple" cx="60" cy="60" r="20" fill="none" stroke="#F5D8B0" strokeWidth="1.2" />}

      {/* the magnetic needle */}
      <g ref={needle} className="compass-needle">
        <path d="M60 14 L63.6 60 L56.4 60 Z" fill="url(#needle-n)" />
        <path d="M60 106 L63.6 60 L56.4 60 Z" fill="url(#needle-s)" />
        <circle cx="60" cy="16.5" r="1.3" fill="#FFF3DA" className="compass-needle-tip" />
      </g>
      <circle cx="60" cy="60" r="4.2" fill="#326C68" stroke="currentColor" />
      <circle cx="59" cy="59" r="1.3" fill="#BFE3DA" opacity=".7" />
      <circle cx="60" cy="60" r="55" fill="url(#compass-glass)" />
      <text x="60" y="4.6" textAnchor="middle" fontSize="7" fill="currentColor" style={{ fontFamily: "var(--font-cinzel)" }}>N</text>
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
