"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Hero from "@/components/scroll/Hero";
import { useScroll } from "@/components/scroll/SmoothScroll";
import { Wordmark } from "@/components/scroll/scene/Wordmark";
import { EVENTS } from "@/content/events";
import { LANDMARKS, PATHWAY_STOPS, REALM_MAP } from "@/content/realm-map";
import { realmActions, realmStore, type RealmStage } from "./realm-store";
import EventNavigation from "./EventNavigation";
import { realmAudio } from "@/components/sound/realm-audio";
import EventDetailsPanel from "./EventDetailsPanel";
import { AtmosphericEffects, CompassRose, MapOrnaments, MobileRealmNav, RealmProgressIndicator, RealmWorld } from "./RealmMap";

gsap.registerPlugin(ScrollTrigger);

/** Scroll length of the pinned experience, in % of the viewport height. Tune pacing here. */
export const REALM_SCROLL = { desktop: 1000, mobile: 760 } as const;

/** Master timeline segments (timeline time = % of the scroll). */
const T = { fade: 0, map: 15, panels: 22, travel: 28, finale: 92, end: 100 } as const;
const SEG = (T.finale - T.travel) / EVENTS.length;
const ARRIVE = 0.55; // share of each event's segment spent travelling; the rest is the stay

const RATIO = REALM_MAP.width / REALM_MAP.height;

/**
 * Hero → mist dissolve → map → ten locations → finale, all driven by one scrubbed, pinned
 * GSAP timeline, so scrolling up reverses everything. Clicking an event scrolls to its
 * point on the timeline, which keeps scroll, camera and selection in sync.
 */
export default function CinematicRealmExperience() {
  const root = useRef<HTMLElement>(null);
  const { scrollTo, registerTarget } = useScroll();

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const q = <T extends Element = HTMLElement>(s: string) => el.querySelector<T>(s)!;
    const stageEl = q(".realm-stage"), world = q(".realm-world"), clouds = q(".realm-clouds");
    const livePaths = el.querySelectorAll<SVGPathElement>(".realm-path-live, .realm-path-glow");
    const html = document.documentElement;

    // ---------- Camera controller (2.5D: transforms on the world layer) ----------
    const cam = { u: 0.5, v: 0.5, z: 1.45, cy: 0.5 };
    const apply = () => {
      const vw = stageEl.clientWidth, vh = stageEl.clientHeight;
      const W = Math.max(vw, vh * RATIO), H = W / RATIO;
      const s = cam.z;
      let tx = vw / 2 - cam.u * W * s, ty = vh * cam.cy - cam.v * H * s;
      tx = Math.min(0, Math.max(vw - W * s, tx));
      ty = Math.min(0, Math.max(vh - H * s, ty));
      // Sharp zoom: the world is laid out at its on-screen size (no scale transform), so the
      // browser draws the map image, the vector path and the markers at full resolution.
      world.style.width = `${Math.round(W * s)}px`;
      world.style.height = `${Math.round(H * s)}px`;
      world.style.transform = `translate3d(${Math.round(tx)}px, ${Math.round(ty)}px, 0)`;
      world.style.setProperty("--stroke", String(1600 / (W * s))); // 1 screen px in path units
      clouds.style.transform = `translate3d(${(tx + (W * s - vw) / 2) * 0.12}px, ${(ty + (H * s - vh) / 2) * 0.12}px, 0) scale(${1 + (s - 1) * 0.25})`;
    };
    const setPath = (p: number) => {
      livePaths.forEach((l) => (l.style.strokeDashoffset = String(1 - p)));
      realmAudio?.path(p);
    };
    const ro = new ResizeObserver(apply);
    ro.observe(stageEl);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      // Simple, accessible version: static map, instant focus on click, every event reachable.
      Object.assign(cam, { z: 1, u: 0.5, v: 0.5 });
      apply();
      setPath(1);
      realmStore.set({ stage: "map", discovered: EVENTS.length });
      const unreg = registerTarget("realm-map", () => stageEl.getBoundingClientRect().top + window.scrollY);
      const io = new IntersectionObserver(
        ([e]) => {
          html.dataset.realm = e.isIntersecting ? "map" : "";
          realmAudio?.progress(e.isIntersecting ? 20 : 0); // valley sound above, sky over the map
        },
        { threshold: 0.5 },
      );
      io.observe(stageEl);
      realmActions.goToEvent = (i) => {
        const lm = LANDMARKS[EVENTS[i].landmark];
        Object.assign(cam, { u: lm.gx, v: lm.gy, z: 1.6, cy: 0.42 });
        apply();
        realmStore.set({ active: i, arrived: true });
      };
      return () => {
        unreg();
        io.disconnect();
        ro.disconnect();
        html.dataset.realm = "";
      };
    }

    const mm = gsap.matchMedia();
    mm.add({ desktop: "(min-width: 1024px)", mobile: "(max-width: 1023px)" }, (ctx) => {
      const desktop = !!ctx.conditions?.desktop;
      const zoom = desktop ? 2.35 : 1.7;
      const pathProxy = { p: 0 };
      Object.assign(cam, { u: 0.5, v: 0.5, z: 1.45, cy: 0.5 });
      apply();
      setPath(0);

      let last = { stage: "", active: -2, arrived: false, discovered: -1 };
      const sync = (t: number) => {
        realmAudio?.progress(t);
        let stage: RealmStage = "hero", active = -1, arrived = false, discovered = 0;
        if (t >= T.fade + 0.5) stage = "fade";
        if (t >= T.map) stage = "map";
        if (t >= T.travel) {
          stage = "travel";
          const k = Math.min(EVENTS.length - 1, Math.floor((t - T.travel) / SEG));
          const local = (t - T.travel) / SEG - k;
          active = k;
          arrived = local >= ARRIVE;
          discovered = arrived ? k + 1 : k;
        }
        if (t >= T.finale) {
          stage = "finale";
          active = -1;
          arrived = false;
          discovered = EVENTS.length;
        }
        if (stage !== last.stage || active !== last.active || arrived !== last.arrived || discovered !== last.discovered) {
          last = { stage, active, arrived, discovered };
          realmStore.set({ stage, active, arrived, discovered, ...(active !== realmStore.get().active ? { detailsOpen: false } : {}) });
          html.dataset.realm = stage === "hero" ? "" : stage;
        }
      };

      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: el,
          start: "top top",
          end: () => `+=${(desktop ? REALM_SCROLL.desktop : REALM_SCROLL.mobile) / 100 * window.innerHeight}`,
          pin: true,
          scrub: 0.7,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => sync(self.progress * 100),
        },
      });
      tl.set({}, {}, T.end); // fix the timeline length at 100 units

      // 1 — the hero dissolves into rising mist, as if descending through the valley's cloud
      const hl = (n: string) => el.querySelector(`.realm-intro [data-l=${n}]`);
      tl.to(hl("content"), { yPercent: -25, autoAlpha: 0, duration: 6, ease: "power1.in" }, T.fade + 0.5)
        .to(hl("near"), { yPercent: -42, scale: 1.12, duration: 9 }, T.fade + 0.5)
        .to(hl("mid"), { yPercent: -18, duration: 9 }, T.fade + 0.5)
        .to(hl("mist"), { yPercent: -18, duration: 9 }, T.fade + 0.5)
        .to(hl("birds"), { yPercent: -30, duration: 9 }, T.fade + 0.5)
        .to(hl("bg"), { scale: 1.14, duration: 11, ease: "power1.in" }, T.fade + 0.5)
        .fromTo(q(".realm-veil"), { autoAlpha: 0, yPercent: 50 }, { autoAlpha: 0.95, yPercent: 0, duration: 6, ease: "sine.inOut" }, T.fade + 2.5)
        .to(q(".realm-intro"), { autoAlpha: 0, duration: 3.5 }, T.fade + 6)
        .to(q(".realm-veil"), { autoAlpha: 0, yPercent: -30, duration: 7, ease: "sine.inOut" }, T.fade + 8.5)
        .fromTo(q(".realm-stage-dim"), { opacity: 0.85 }, { opacity: 0, duration: 8 }, T.fade + 7.5);
      // 2–3 — the kingdom comes into full view as the camera settles
      tl.to(cam, { z: 1, duration: T.panels - T.fade - 7.5, ease: "power2.inOut", onUpdate: apply }, T.fade + 7.5)
        .fromTo(q(".realm-heading"), { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 4, ease: "power2.out" }, T.map)
        .fromTo(q(".realm-frame"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 4 }, T.map + 1);
      // 4 — event panels
      tl.fromTo(q(".realm-nav-online"), { autoAlpha: 0, x: -24 }, { autoAlpha: 1, x: 0, duration: 3, ease: "power2.out" }, T.panels)
        .fromTo(q(".realm-nav-offline"), { autoAlpha: 0, x: 24 }, { autoAlpha: 1, x: 0, duration: 3, ease: "power2.out" }, T.panels + 0.4)
        .fromTo(el.querySelectorAll(".realm-nav-item"), { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 1.2, stagger: 0.25 }, T.panels + 0.6)
        .fromTo(q(".realm-mobile-nav"), { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 3 }, T.panels)
        .to(q(".realm-heading"), { autoAlpha: 0, y: -16, duration: 3 }, T.travel - 2);
      // 5 — travel to each location; the pathway draws itself along the way
      EVENTS.forEach((ev, i) => {
        const lm = LANDMARKS[ev.landmark];
        const at = T.travel + i * SEG;
        tl.to(cam, { u: lm.gx, v: lm.gy, z: zoom, cy: desktop ? 0.42 : 0.4, duration: SEG * ARRIVE, ease: "power2.inOut", onUpdate: apply }, at)
          .to(pathProxy, { p: PATHWAY_STOPS[i], duration: SEG * ARRIVE, ease: "power1.inOut", onUpdate: () => setPath(pathProxy.p) }, at);
      });
      // 6 — the whole kingdom, every location lit
      tl.to(cam, { u: 0.5, v: 0.5, z: 1, cy: 0.5, duration: T.end - T.finale - 1, ease: "power2.inOut", onUpdate: apply }, T.finale)
        .to(pathProxy, { p: 1, duration: 4, onUpdate: () => setPath(pathProxy.p) }, T.finale)
        .fromTo(q(".realm-heading"), { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 4, immediateRender: false }, T.finale + 2)
        .fromTo(q(".realm-outro"), { autoAlpha: 0, yPercent: 40 }, { autoAlpha: 1, yPercent: 0, duration: 3.5, ease: "power2.out" }, T.end - 3.5);

      const st = tl.scrollTrigger!;
      const yAt = (t: number) => st.start + (t / 100) * (st.end - st.start);
      const unreg = registerTarget("realm-map", () => yAt(T.panels + 4.4)); // map shown, panels fully revealed
      realmActions.goToEvent = (i) => scrollTo(yAt(T.travel + (i + ARRIVE + 0.2) * SEG), { duration: 1.6 });

      return () => {
        unreg();
        html.dataset.realm = "";
      };
    });

    return () => {
      mm.revert();
      ro.disconnect();
    };
  }, [registerTarget, scrollTo]);

  return (
    <section ref={root} className="realm" aria-label="The Realm of TechXcelerate">
      {/* ---------- The hidden kingdom ---------- */}
      <div id="realm-map" className="realm-stage">
        <div className="realm-camera">
          <RealmWorld />
        </div>
        <AtmosphericEffects />
        <div className="realm-stage-dim" aria-hidden="true" />

        <div className="realm-frame" aria-hidden="true">
          <MapOrnaments />
          <CompassRose />
        </div>

        <header className="realm-heading">
          <p className="realm-heading-kicker">The Realm of</p>
          <h2 className="realm-heading-title">
            <Wordmark title="TechXcelerate" idPrefix="wm-realm" />
          </h2>
          <p className="realm-heading-sub">Explore the Realm of Innovation</p>
        </header>

        <RealmProgressIndicator />
        <EventNavigation mode="online" />
        <EventNavigation mode="offline" />
        <MobileRealmNav />
        <EventDetailsPanel />
      </div>

      {/* ---------- The hero, which dissolves into the mist ---------- */}
      <div className="realm-intro">
        <Hero scrollParallax={false} />
      </div>
      <div className="realm-veil" aria-hidden="true">
        <div className="realm-veil-fill" />
        <div className="realm-veil-bank realm-veil-b1" />
        <div className="realm-veil-bank realm-veil-b2" />
        <div className="realm-veil-bank realm-veil-b3" />
        <div className="realm-veil-bank realm-veil-p1" />
        <div className="realm-veil-bank realm-veil-p2" />
      </div>
      <div className="realm-outro" aria-hidden="true">
        <div className="realm-veil-bank realm-veil-b2" />
        <div className="realm-veil-bank realm-veil-b1" />
      </div>
    </section>
  );
}
