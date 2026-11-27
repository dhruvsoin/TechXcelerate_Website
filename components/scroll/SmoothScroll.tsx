"use client";

import { createContext, useCallback, useContext, useEffect, useRef } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "lenis/dist/lenis.css";

gsap.registerPlugin(ScrollTrigger);

type MotionMode = "full" | "lite" | "reduced";

type ScrollApi = {
  /** Smoothly scroll to a chapter id or "#id", a registered target name, or a pixel offset. */
  scrollTo: (target: string | number, opts?: { duration?: number }) => void;
  /** Register a named scroll position that is computed on demand (e.g. a point inside a pinned timeline). */
  registerTarget: (name: string, getY: () => number) => () => void;
};

const ScrollContext = createContext<ScrollApi>({ scrollTo: () => {}, registerTarget: () => () => {} });
const targets = new Map<string, () => number>();

export const useScroll = () => useContext(ScrollContext);

function detectMode(): MotionMode {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "reduced";
  const nav = navigator as Navigator & { deviceMemory?: number };
  const lowCpu = (nav.hardwareConcurrency ?? 8) <= 4;
  const lowMem = (nav.deviceMemory ?? 8) <= 4;
  return lowCpu || lowMem ? "lite" : "full";
}

/**
 * Lenis smooth scroll synced with GSAP ScrollTrigger.
 * Sets data-motion="full|lite|reduced" on <html> so CSS can simplify scenes.
 */
export default function SmoothScroll({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    const m = detectMode();
    document.documentElement.dataset.motion = m;

    if (m === "reduced") return;

    const lenis = new Lenis({ autoRaf: false, lerp: 0.09, anchors: true });
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

  const scrollTo = useCallback((target: string | number, opts?: { duration?: number }) => {
    const duration = opts?.duration ?? 1.8;
    const named = typeof target === "string" ? targets.get(target.replace(/^#/, "")) : undefined;
    if (typeof target === "number" || named) {
      const y = typeof target === "number" ? target : named!();
      if (lenisRef.current) lenisRef.current.scrollTo(y, { duration });
      else window.scrollTo({ top: y });
      return;
    }
    const id = target.startsWith("#") ? target : `#${target}`;
    const el = document.querySelector<HTMLElement>(id);
    if (!el) return;
    if (lenisRef.current) {
      lenisRef.current.scrollTo(el, { duration });
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

  return <ScrollContext.Provider value={{ scrollTo, registerTarget }}>{children}</ScrollContext.Provider>;
}
