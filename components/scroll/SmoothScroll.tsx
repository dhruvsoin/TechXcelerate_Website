"use client";

import { createContext, useCallback, useContext, useEffect, useRef } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "lenis/dist/lenis.css";

gsap.registerPlugin(ScrollTrigger);

type MotionMode = "full" | "lite" | "reduced";

type ScrollOpts = { duration?: number; easing?: (t: number) => number };

type ScrollApi = {
  /** Smoothly scroll to a chapter id or "#id", a registered target name, or a pixel offset. */
  scrollTo: (target: string | number, opts?: ScrollOpts) => void;
  /** Register a named scroll position that is computed on demand (e.g. a point inside a pinned timeline). */
  registerTarget: (name: string, getY: () => number) => () => void;
  /**
   * Stop a fast scroll at `y` and hold it there briefly, cancelling any wheel or touch momentum, so a
   * scene isn't skipped. Input resumes after the hold.
   */
  holdAt: (y: number) => void;
  /**
   * Play a scroll to `y` from start to finish (a scene that shouldn't stop half-way): wheel and touch
   * input, and any momentum, are paused until it arrives.
   */
  glideTo: (y: number, opts: { duration: number; easing?: (t: number) => number }) => void;
};

const ScrollContext = createContext<ScrollApi>({ scrollTo: () => {}, registerTarget: () => () => {}, holdAt: () => {}, glideTo: () => {} });
const targets = new Map<string, () => number>();

/** Until when the page is being moved by code (a menu link, an event click, a settle or a hold), not the visitor. */
let autoUntil = 0;
const markAuto = (ms: number) => (autoUntil = Math.max(autoUntil, performance.now() + ms));
/** True while a scroll started by the site itself is running; fast-scroll checkpoints ignore those. */
export const isAutoScrolling = () => performance.now() < autoUntil;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export const useScroll = () => useContext(ScrollContext);

/** "reduced" (visitor asked for less motion), "lite" (low-power device) or "full". */
export function detectMotionMode(): MotionMode {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "reduced";
  const nav = navigator as Navigator & { deviceMemory?: number };
  // Only genuinely weak devices: most ordinary laptops have 4 threads or 4 GB and handle the full scene.
  const lowCpu = (nav.hardwareConcurrency ?? 8) <= 2;
  const lowMem = (nav.deviceMemory ?? 8) <= 2;
  return lowCpu || lowMem ? "lite" : "full";
}

/**
 * Lenis smooth scroll synced with GSAP ScrollTrigger.
 * Sets data-motion="full|lite|reduced" on <html> so CSS can simplify scenes.
 */
export default function SmoothScroll({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    const m = detectMotionMode();
    document.documentElement.dataset.motion = m;

    if (m === "reduced") return;

    const lenis = new Lenis({ autoRaf: false, lerp: 0.1, anchors: true });
    lenisRef.current = lenis;
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  const scrollTo = useCallback((target: string | number, opts?: ScrollOpts) => {
    const duration = opts?.duration ?? 1.8;
    const easing = opts?.easing;
    markAuto(duration * 1000 + 250);
    const named = typeof target === "string" ? targets.get(target.replace(/^#/, "")) : undefined;
    if (typeof target === "number" || named) {
      const y = typeof target === "number" ? target : named!();
      if (lenisRef.current) lenisRef.current.scrollTo(y, { duration, easing });
      else window.scrollTo({ top: y });
      return;
    }
    const id = target.startsWith("#") ? target : `#${target}`;
    const el = document.querySelector<HTMLElement>(id);
    if (!el) return;
    if (lenisRef.current) {
      lenisRef.current.scrollTo(el, { duration, easing });
    } else {
      el.scrollIntoView({ behavior: "auto" });
    }
    // Move focus for keyboard and screen-reader users.
    el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });
  }, []);

  const registerTarget = useCallback((name: string, getY: () => number) => {
    targets.set(name, getY);
    return () => {
      if (targets.get(name) === getY) targets.delete(name);
    };
  }, []);

  const holdAt = useCallback((y: number) => {
    const lenis = lenisRef.current;
    const HOLD = 0.35, PAUSE = 150; // a quick ease into the checkpoint and a brief beat before input resumes
    markAuto(HOLD * 1000 + PAUSE + 150);
    if (!lenis) {
      window.scrollTo({ top: y });
      return;
    }
    // stop() also halts native touch momentum (it locks overflow); force lets us move while stopped
    lenis.stop();
    let resumed = false;
    const resume = () => {
      if (resumed) return;
      resumed = true;
      lenis.start();
    };
    lenis.scrollTo(y, {
      force: true,
      lock: true,
      duration: HOLD,
      easing: easeOutCubic,
      onComplete: () => window.setTimeout(resume, PAUSE),
    });
    window.setTimeout(resume, HOLD * 1000 + PAUSE + 400); // never leave scrolling stopped
  }, []);

  const glideTo = useCallback((y: number, { duration, easing }: { duration: number; easing?: (t: number) => number }) => {
    const lenis = lenisRef.current;
    markAuto(duration * 1000 + 200);
    if (!lenis) {
      window.scrollTo({ top: y });
      return;
    }
    lenis.stop(); // halts wheel smoothing and native touch momentum
    let resumed = false;
    const resume = () => {
      if (resumed) return;
      resumed = true;
      lenis.start();
    };
    lenis.scrollTo(y, { force: true, lock: true, duration, easing, onComplete: () => window.setTimeout(resume, 80) });
    window.setTimeout(resume, duration * 1000 + 600); // never leave scrolling stopped
  }, []);

  return <ScrollContext.Provider value={{ scrollTo, registerTarget, holdAt, glideTo }}>{children}</ScrollContext.Provider>;
}
