"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Hero from "@/components/scroll/Hero";
import { isAutoScrolling, useScroll } from "@/components/scroll/SmoothScroll";
import { EVENTS } from "@/content/events";
import { LANDMARKS, PATHWAY_STOPS, REALM_MAP } from "@/content/realm-map";
import { realmActions, realmCamera, realmStore, type RealmStage } from "./realm-store";
import EventNavigation from "./EventNavigation";
import { realmAudio } from "@/components/sound/realm-audio";
import EventDetailsPanel from "./EventDetailsPanel";
import MapLife from "./MapLife";
import { AtmosphericEffects, CompassRose, MapOrnaments, MobileRealmNav, RealmProgressIndicator, RealmWorld } from "./RealmMap";

gsap.registerPlugin(ScrollTrigger);

/** Scroll length of the pinned experience, in % of the viewport height. Tune pacing here. */
export const REALM_SCROLL = { desktop: 1000, mobile: 760 } as const;

/** Master timeline segments (timeline time = % of the scroll). */
const T = { fade: 0, map: 15, panels: 22, travel: 28, finale: 92, end: 100 } as const;
const SEG = (T.finale - T.travel) / EVENTS.length;
const ARRIVE = 0.55; // share of each event's segment spent travelling; the rest is the stay

const RATIO = REALM_MAP.width / REALM_MAP.height;
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Castle match-cut. The hero pushes into its castle (this point on the photo, as a fraction of
 * the photo frame: the main keep's lit windows), the window glow fills the screen, and the map
 * opens close on its own castle at the same spot on screen before pulling back to the whole realm.
 */
const HERO_CASTLE = { x: 0.566, y: 0.27 } as const;
const MAP_CASTLE = LANDMARKS.castle;
const CUT = { push: 3.4, zDesktop: 4, zMobile: 3.2, at: T.fade + 7.5 } as const;

/**
 * Hero → castle match-cut → map → ten locations → finale, all driven by one scrubbed, pinned
 * GSAP timeline, so scrolling up reverses everything. Clicking an event scrolls to its
 * point on the timeline, which keeps scroll, camera and selection in sync.
 */
export default function CinematicRealmExperience() {
  const root = useRef<HTMLElement>(null);
  const { scrollTo, registerTarget, holdAt, glideTo } = useScroll();

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const q = <T extends Element = HTMLElement>(s: string) => el.querySelector<T>(s)!;
    const stageEl = q(".realm-stage"), world = q(".realm-world"), clouds = q(".realm-clouds");
    const livePaths = el.querySelectorAll<SVGPathElement>(".realm-path-live, .realm-path-glow");
    const html = document.documentElement;

    // ---------- Camera controller (2.5D: transforms on the world layer) ----------
    // cx / cy: where on screen (0–1) the camera's target point sits
    const cam = { u: 0.5, v: 0.5, z: 1.45, cx: 0.5, cy: 0.5 };
    let layoutW = 0, layoutBucket = 0;
    const apply = () => {
      const vw = stageEl.clientWidth, vh = stageEl.clientHeight;
      const W = Math.max(vw, vh * RATIO), H = W / RATIO;
      const s = cam.z;
      realmCamera.u = cam.u;
      realmCamera.v = cam.v;
      let tx = vw * cam.cx - cam.u * W * s, ty = vh * cam.cy - cam.v * H * s;
      tx = Math.min(0, Math.max(vw - W * s, tx));
      ty = Math.min(0, Math.max(vh - H * s, ty));
      Object.assign(realmCamera, { tx, ty, ws: W * s, hs: H * s });
      // Sharp *and* smooth zoom: the world is laid out close to its on-screen size, so the map
      // image, path and markers are drawn at full resolution, but only re-laid out when the zoom
      // crosses a quarter-octave step. In between, a GPU scale of at most ±9% covers the rest,
      // so a zoom costs a handful of re-layouts instead of one every frame.
      const bucket = Math.pow(2, Math.round(Math.log2(s) * 4) / 4);
      if (bucket !== layoutBucket || Math.abs(layoutW - W * bucket) > 1) {
        layoutBucket = bucket;
        layoutW = Math.round(W * bucket);
        world.style.width = `${layoutW}px`;
        world.style.height = `${Math.round(H * bucket)}px`;
        world.style.setProperty("--stroke", String(1600 / layoutW)); // 1 screen px in path units
      }
      const r = (W * s) / layoutW;
      world.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${r.toFixed(5)})`;
      world.style.setProperty("--inv", (1 / r).toFixed(5)); // markers keep their size
      clouds.style.transform = `translate3d(${((tx + (W * s - vw) / 2) * 0.12).toFixed(2)}px, ${((ty + (H * s - vh) / 2) * 0.12).toFixed(2)}px, 0) scale(${(1 + (s - 1) * 0.25).toFixed(4)})`;
    };
    const setPath = (p: number) => {
      livePaths.forEach((l) => (l.style.strokeDashoffset = String(1 - p)));
      realmCamera.path = p;
      realmAudio?.path(p);
    };
    // Where the hero's castle sits on screen. Read from layout offsets (not getBoundingClientRect),
    // so the push-in's own scale and the photo's slow camera drift don't skew it.
    const intro = q(".realm-intro"), glow = q(".realm-glow");
    const castlePt = { x: 0, y: 0, fx: 0.5, fy: 0.3 };
    const placeCastle = () => {
      const frame = intro.querySelector<HTMLElement>(".photo-frame");
      if (!frame) return;
      castlePt.x = frame.offsetLeft + HERO_CASTLE.x * frame.offsetWidth;
      castlePt.y = frame.offsetTop + HERO_CASTLE.y * frame.offsetHeight;
      castlePt.fx = castlePt.x / Math.max(1, el.clientWidth);
      castlePt.fy = castlePt.y / Math.max(1, el.clientHeight);
      const bg = intro.querySelector<HTMLElement>("[data-l=bg]");
      if (bg) bg.style.transformOrigin = `${castlePt.x}px ${castlePt.y}px`; // the photo zooms into the castle
      glow.style.left = `${castlePt.x}px`;
      glow.style.top = `${castlePt.y}px`;
    };
    placeCastle();
    ScrollTrigger.addEventListener("refreshInit", placeCastle);

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
        ScrollTrigger.removeEventListener("refreshInit", placeCastle);
        html.dataset.realm = "";
      };
    }

    const mm = gsap.matchMedia();
    mm.add({ desktop: "(min-width: 1024px)", mobile: "(max-width: 1023px)" }, (ctx) => {
      const desktop = !!ctx.conditions?.desktop;
      const zoom = desktop ? 2.35 : 1.7;
      const pathProxy = { p: 0 };
      // The map camera starts close on its castle, at the same screen point as the hero's castle.
      const cutZ = desktop ? CUT.zDesktop : CUT.zMobile;
      const cutCam = () => ({ u: MAP_CASTLE.gx, v: MAP_CASTLE.gy, z: cutZ, cx: castlePt.fx, cy: castlePt.fy });
      Object.assign(cam, cutCam());
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
          // Lenis already smooths the wheel, so keep this short; on touch (no Lenis smoothing) a
          // little more catch-up irons out finger jitter.
          scrub: desktop ? 0.4 : 0.6,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => sync(self.progress * 100),
        },
      });
      tl.set({}, {}, T.end); // fix the timeline length at 100 units

      // 1 — castle match-cut: push into the castle, its window light fills the screen…
      const hl = (n: string) => el.querySelector(`.realm-intro [data-l=${n}]`);
      tl.to(hl("content"), { yPercent: -20, autoAlpha: 0, duration: 3.5, ease: "power1.in" }, T.fade + 0.5)
        .to(hl("near"), { yPercent: 45, scale: 1.35, autoAlpha: 0, duration: 5, ease: "power1.in" }, T.fade + 0.5) // clouds slip under the camera
        .to(hl("birds"), { autoAlpha: 0, duration: 3 }, T.fade + 0.5)
        .to(hl("eagles"), { autoAlpha: 0, duration: 2.5 }, T.fade + 0.5)
        // Only the castle photo zooms (one image layer). Scaling the whole hero, with its dozen
        // cloud, mist and light layers, ran the browser out of graphics memory and left stale or
        // missing tiles when scrolling back. The rest of the scene fades out during the push instead.
        .to(hl("atmos"), { autoAlpha: 0, duration: 4.5, ease: "power1.in" }, T.fade + 0.5)
        .fromTo(hl("bg"), { scale: 1 }, { scale: CUT.push, duration: CUT.at - T.fade - 0.5, ease: "power2.in" }, T.fade + 0.5)
        .fromTo(glow, { autoAlpha: 0, scale: 0.15 }, { autoAlpha: 1, scale: 5, duration: CUT.at - T.fade - 3, ease: "power2.in" }, T.fade + 3)
        .to(intro, { autoAlpha: 0, duration: 0.4 }, CUT.at - 0.3)
        // …and when it clears, the same castle seen from above on the map
        .to(glow, { autoAlpha: 0, scale: 7, duration: 5, ease: "power1.out" }, CUT.at + 0.3)
        .fromTo(q(".realm-stage-dim"), { opacity: 0.55 }, { opacity: 0, duration: 4 }, CUT.at);
      // 2–3 — the camera pulls back from the castle until the whole kingdom is in view
      tl.fromTo(
        cam,
        { u: () => cutCam().u, v: () => cutCam().v, z: () => cutCam().z, cx: () => cutCam().cx, cy: () => cutCam().cy },
        { u: 0.5, v: 0.5, z: 1, cx: 0.5, cy: 0.5, duration: T.panels - CUT.at, ease: "sine.inOut", onUpdate: apply },
        CUT.at,
      )
        .fromTo(q(".realm-frame"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 4 }, T.map + 1);
      // 4 — event panels
      tl.fromTo(q(".realm-nav-online"), { autoAlpha: 0, x: -24 }, { autoAlpha: 1, x: 0, duration: 3, ease: "power2.out" }, T.panels)
        .fromTo(q(".realm-nav-offline"), { autoAlpha: 0, x: 24 }, { autoAlpha: 1, x: 0, duration: 3, ease: "power2.out" }, T.panels + 0.4)
        .fromTo(el.querySelectorAll(".realm-nav-item"), { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 1.2, stagger: 0.25 }, T.panels + 0.6)
        .fromTo(q(".realm-mobile-nav"), { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 3 }, T.panels);
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
        .fromTo(q(".realm-outro"), { autoAlpha: 0, yPercent: 40 }, { autoAlpha: 1, yPercent: 0, duration: 3.5, ease: "power2.out" }, T.end - 3.5);

      const st = tl.scrollTrigger!;
      const yAt = (t: number) => st.start + (t / 100) * (st.end - st.start);
      const eventAt = (i: number) => T.travel + (i + ARRIVE + 0.2) * SEG; // arrived, card shown
      const unreg = registerTarget("realm-map", () => yAt(T.panels + 4.4)); // map shown, panels fully revealed
      // Flights between events take longer the further they go, and ease in and out.
      realmActions.goToEvent = (i) => {
        const span = Math.abs(eventAt(i) - (st.progress * 100));
        scrollTo(yAt(eventAt(i)), { duration: Math.min(3.2, Math.max(1.1, 0.9 + span * 0.05)), easing: easeInOutCubic });
      };

      const tOf = (y: number) => ((y - st.start) / (st.end - st.start)) * 100;

      // ---------- Hero ↔ map: one smooth glide, never stopped half-way ----------
      // A part-played castle transition looks broken (a half-zoomed hero under a half-faded glow, or
      // hero text still half-faded and shifted up), so it always plays through: a little scroll down
      // from the hero glides through the push-in, glow and pull-back to the whole map; a little scroll
      // up from the map glides all the way back to a clean hero. Input is paused only for the glide.
      const OVERVIEW = T.panels + 4.4; // the whole map, panels in
      const TRANSITION_END = OVERVIEW - 0.3;
      const glide = (y: number, prevY: number) => {
        if (isAutoScrolling() || y === prevY) return false;
        const t = tOf(y), was = tOf(prevY);
        if (t <= 0.25 || t >= TRANSITION_END) return false;
        const to = y > prevY ? OVERVIEW : 0; // go where the visitor was heading
        const duration = 0.8 + 1.8 * (Math.abs(to - t) / OVERVIEW); // ~2.6s for the whole transition
        if (to === 0 && was >= TRANSITION_END + 6) return false; // a fast fling from far into the map: let the checkpoints catch it first
        window.clearTimeout(idle);
        glideTo(yAt(to), { duration, easing: easeInOutCubic });
        return true;
      };

      // ---------- Settle onto an event when scrolling stops ----------
      // On the map, stopping between two events (or between the overview and the first event, or
      // the last event and the finale) eases on to the next one in the direction you were scrolling,
      // or back if you'd barely moved. Long distances are never auto-scrolled.
      const MAP_STOPS = [OVERVIEW, ...EVENTS.map((_, i) => eventAt(i)), T.end - 4];
      let idle = 0, lastY = window.scrollY, dir = 1, touching = false, settling = 0;
      const settle = () => {
        if (touching || performance.now() < settling || isAutoScrolling() || realmStore.get().detailsOpen) return;
        const y = window.scrollY;
        if (y <= st.start + 2 || y >= st.end - 2) return;
        const t = ((y - st.start) / (st.end - st.start)) * 100;
        let to: number | null = null;
        if (t > MAP_STOPS[0]) {
          const k = MAP_STOPS.findIndex((s) => s > t);
          if (k > 0) {
            const prev = MAP_STOPS[k - 1], next = MAP_STOPS[k];
            const f = (t - prev) / (next - prev);
            if (Math.min(t - prev, next - t) >= 0.35) to = dir > 0 ? (f > 0.2 ? next : prev) : f < 0.8 ? prev : next;
          }
        }
        if (to === null) return;
        const dy = Math.abs(yAt(to) - y);
        if (dy > window.innerHeight * 0.9) return; // too far to take over; let the visitor carry on
        const duration = Math.min(1.2, 0.5 + (dy / window.innerHeight) * 0.7);
        settling = performance.now() + duration * 1000 + 150;
        scrollTo(yAt(to), { duration, easing: easeInOutCubic });
      };
      // ---------- Fast-scroll checkpoints ----------
      // The whole map (just after the castle transition), each event and the finale are checkpoints.
      // Scrolling fast across one (wheel fling, trackpad swipe, touch flick, keyboard) stops there and
      // holds a moment, so its scene plays out instead of flashing past; the next flick carries on.
      // Slow scrolling flows through untouched, and the site's own scrolls (menu links, event clicks,
      // settles) are never stopped.
      // only real flings (over ~3.5 screens a second); ordinary scrolling, even brisk, is never stopped
      const FAST = () => window.innerHeight * 3.5; // px per second
      let prevT = performance.now(), speed = 0;
      const checkpoint = (y: number) => {
        const now = performance.now();
        const v = Math.abs(y - lastY) / Math.max(0.008, (now - prevT) / 1000);
        prevT = now;
        speed = speed * 0.5 + v * 0.5;
        if (isAutoScrolling() || speed < FAST() || y === lastY) return false;
        const a = tOf(lastY), b = tOf(y);
        const crossed = y > lastY
          ? MAP_STOPS.find((g) => a < g - 0.05 && b >= g)
          : [...MAP_STOPS].reverse().find((g) => a > g + 0.05 && b <= g);
        if (crossed === undefined) return false;
        speed = 0;
        window.clearTimeout(idle);
        holdAt(yAt(crossed));
        return true;
      };

      const onScroll = () => {
        const y = window.scrollY;
        const held = glide(y, lastY) || checkpoint(y);
        if (y !== lastY) dir = y > lastY ? 1 : -1;
        lastY = y;
        if (held || isAutoScrolling() || performance.now() < settling) return; // the site is moving the page
        window.clearTimeout(idle);
        idle = window.setTimeout(settle, 280); // wait out the gap between wheel clicks
      };
      const onTouchStart = () => ((touching = true), window.clearTimeout(idle));
      const onTouchEnd = () => ((touching = false), onScroll());
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("touchstart", onTouchStart, { passive: true });
      window.addEventListener("touchend", onTouchEnd, { passive: true });

      return () => {
        unreg();
        window.clearTimeout(idle);
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("touchstart", onTouchStart);
        window.removeEventListener("touchend", onTouchEnd);
        html.dataset.realm = "";
      };
    });

    return () => {
      mm.revert();
      ro.disconnect();
      ScrollTrigger.removeEventListener("refreshInit", placeCastle);
    };
  }, [registerTarget, scrollTo, holdAt, glideTo]);

  return (
    <section ref={root} className="realm" aria-label="The Realm of TechXcelerate">
      {/* ---------- The hidden kingdom ---------- */}
      <div id="realm-map" className="realm-stage">
        <div className="realm-camera">
          <RealmWorld />
        </div>
        <MapLife />
        <AtmosphericEffects />
        <div className="realm-stage-dim" aria-hidden="true" />

        <div className="realm-frame" aria-hidden="true">
          <MapOrnaments />
          <CompassRose />
        </div>

        <h2 className="sr-only">The Realm of TechXcelerate</h2>

        <RealmProgressIndicator />
        <EventNavigation mode="online" />
        <EventNavigation mode="offline" />
        <MobileRealmNav />
        <EventDetailsPanel />
      </div>

      {/* ---------- The hero, which the camera pushes into ---------- */}
      <div className="realm-intro">
        <Hero scrollParallax={false} />
      </div>
      {/* The castle's window light, which fills the screen at the cut */}
      <div className="realm-glow" aria-hidden="true" />
      <div className="realm-outro" aria-hidden="true">
        <div className="realm-veil-bank realm-veil-b2" />
        <div className="realm-veil-bank realm-veil-b1" />
      </div>
    </section>
  );
}
