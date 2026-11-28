"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { site } from "@/content/site";
import { useScroll } from "./SmoothScroll";
import Raven from "./scene/Raven";
import Eagle, { type Flight } from "./scene/Eagle";
import { Wordmark, WordmarkDivider } from "./scene/Wordmark";
import { CASTLE_BLUR, WINDOWS } from "./scene/castle-data";
import Countdown from "./Countdown";
import LivingPhoto from "./scene/LivingPhoto";
import { playSfx } from "@/components/sound/realm-audio";

const EAGLE_MAIN: Flight = { cx: 0.8, cy: 0.22, radius: 0.1, size: 0.042, period: 26, phase: 0.6, haze: 0.08, flapEvery: 9 };
const EAGLE_FAR: Flight = { cx: 0.17, cy: 0.17, radius: 0.06, size: 0.018, period: -34, phase: 2.4, haze: 0.3, flapEvery: 12 };

type CloudLayer = { src: string; w: number; h: number; style: React.CSSProperties; drift: string; lite?: boolean };
const cloud = (n: string, w: number, h: number) => ({ src: `/hero/clouds/${n}.webp`, w, h });
const FAR_CLOUDS: CloudLayer[] = [
  { ...cloud("puff-2", 791, 570), style: { left: "68%", top: "17%", width: "30vw", opacity: 0.72 }, drift: "drift-a" },
  { ...cloud("puff-3", 749, 531), style: { left: "86%", top: "1%", width: "22vw", opacity: 0.5 }, drift: "drift-b", lite: true },
];
const MID_CLOUDS: CloudLayer[] = [
  { ...cloud("bank-2", 1268, 468), style: { left: "56%", top: "58%", width: "52vw", opacity: 0.78 }, drift: "drift-b" },
];
const NEAR_CLOUDS: CloudLayer[] = [
  { ...cloud("bank-1", 1337, 439), style: { left: "-22%", top: "79%", width: "72vw", opacity: 0.86 }, drift: "drift-a" },
  { ...cloud("bank-3", 1506, 443), style: { left: "38%", top: "84%", width: "78vw", opacity: 0.82 }, drift: "drift-b", lite: true },
];

function Clouds({ layers }: { layers: CloudLayer[] }) {
  return (
    <>
      {layers.map((c) => (
        <div key={c.src} className={`absolute ${c.lite ? "lite-hide" : ""}`} style={c.style}>
          <div className={`cloud-feather ${c.drift}`}>
            <Image src={c.src} alt="" width={c.w} height={c.h} sizes="(max-width: 1023px) 90vw, 70vw" className="h-auto w-full select-none" draggable={false} />
          </div>
        </div>
      ))}
    </>
  );
}

gsap.registerPlugin(ScrollTrigger);

/** Sunlit dust motes: deterministic positions (left %, top %, delay s, duration s, size px). */
const motes = Array.from({ length: 14 }, (_, i) => ({
  left: 6 + ((i * 41) % 60),
  top: 30 + ((i * 23) % 50),
  delay: ((i * 7) % 11) * 1.1,
  dur: 14 + ((i * 5) % 9),
  size: 2 + (i % 3),
}));

/** Fireflies near the trees (left %, top %, delay s, duration s). */
const fireflies = [
  [9, 63, 0, 9], [17, 73, 2.1, 11], [6, 82, 4.3, 10], [25, 88, 1.2, 12], [31, 69, 5.5, 9],
  [86, 62, 0.8, 10], [92, 75, 3.4, 12], [78, 83, 2.7, 9], [69, 91, 4.9, 11], [96, 88, 1.9, 10],
] as const;

/**
 * Chapter I — The Valley (FR-02).
 * The castle photograph is shown exactly as supplied; motion comes only from
 * a slow camera push, drifting mist, sky wisps, sunlight and distant ravens.
 */
type HeroProps = {
  /** Inside the pinned realm the realm timeline drives these layers, so the hero's own scroll parallax is off. */
  scrollParallax?: boolean;
};

export default function Hero({ scrollParallax = true }: HeroProps) {
  const root = useRef<HTMLElement>(null);
  const { scrollTo } = useScroll();

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const mm = gsap.matchMedia();
    if (scrollParallax) mm.add("(prefers-reduced-motion: no-preference)", () => {
      const q = gsap.utils.selector(el);
      gsap
        .timeline({
          defaults: { ease: "none" },
          scrollTrigger: { trigger: el, start: "top top", end: "bottom top", scrub: 0.8 },
        })
        .to(q("[data-l=bg]"), { yPercent: 14 }, 0)
        .to(q("[data-l=mist]"), { yPercent: -18 }, 0)
        .to(q("[data-l=birds]"), { yPercent: -30 }, 0)
        .to(q("[data-l=far]"), { yPercent: -6 }, 0)
        .to(q("[data-l=eagles]"), { yPercent: -22 }, 0)
        .to(q("[data-l=mid]"), { yPercent: -18 }, 0)
        .to(q("[data-l=near]"), { yPercent: -42, scale: 1.12 }, 0)
        .to(q("[data-l=content]"), { yPercent: -25, opacity: 0 }, 0);
    });

    // Mouse parallax (desktop pointer only): nearer layers move further.
    mm.add("(prefers-reduced-motion: no-preference) and (pointer: fine) and (min-width: 1024px)", () => {
      if (document.documentElement.dataset.motion === "lite") return;
      const depth: [string, number][] = [["bg", 7], ["far", 12], ["eagles", 16], ["mid", 20], ["mist", 16], ["birds", 18], ["near", 34], ["content", -6]];
      const movers = depth.map(([name, px]) => {
        const node = el.querySelector(`[data-l=${name}]`);
        return node ? { x: gsap.quickTo(node, "x", { duration: 1.4, ease: "power3" }), y: gsap.quickTo(node, "y", { duration: 1.4, ease: "power3" }), px } : null;
      });
      const onMove = (e: PointerEvent) => {
        const nx = e.clientX / window.innerWidth - 0.5;
        const ny = e.clientY / window.innerHeight - 0.5;
        movers.forEach((m) => {
          if (!m) return;
          m.x(-nx * m.px * 2);
          m.y(-ny * m.px * 1.2);
        });
      };
      window.addEventListener("pointermove", onMove, { passive: true });
      return () => window.removeEventListener("pointermove", onMove);
    });
    return () => mm.revert();
  }, [scrollParallax]);

  const go = (href: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    scrollTo(href);
  };

  return (
    <section
      ref={root}
      id="valley"
      aria-labelledby="hero-title"
      className="relative isolate min-h-svh w-full overflow-hidden bg-navy-950"
    >
      {/* ---------- Background photograph (unaltered) ---------- */}
      <div data-l="bg" aria-hidden="true" className="absolute inset-0 -z-10">
        <div className="photo-stage camera-push">
          {/* Frame matches the photo's proportions, so the window lights stay on the castle at any crop. */}
          <div className="photo-frame">
            <Image
              src="/hero/castle.jpg"
              alt=""
              fill
              priority
              sizes="(max-aspect-ratio: 3/4) 160vw, 100vw"
              quality={85}
              placeholder="blur"
              blurDataURL={CASTLE_BLUR}
              className="object-cover"
            />
            <LivingPhoto />
            <div className="castle-lights">
              {WINDOWS.map(([x, y], i) => (
                <span
                  key={i}
                  className="castle-window"
                  style={{ left: `${x * 100}%`, top: `${y * 100}%`, "--d": `${(i * 0.73) % 5}s`, "--t": `${3 + (i % 4) * 0.9}s` } as React.CSSProperties}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ---------- Atmosphere (decorative) ---------- */}
      <div data-l="atmos" aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="sunlight absolute inset-0" />
        <div className="sky-wisps absolute inset-x-0 top-0 h-[26%]">
          <div className="wisp-track wisp-track-slow" />
        </div>
        <div data-l="far" className="absolute inset-0">
          <Clouds layers={FAR_CLOUDS} />
        </div>
        <div data-l="eagles" className="absolute inset-0">
          <Eagle flight={EAGLE_FAR} className="eagle-far lite-hide" />
          <Eagle flight={EAGLE_MAIN} />
        </div>
        <div data-l="mid" className="absolute inset-0">
          <Clouds layers={MID_CLOUDS} />
        </div>
        <div data-l="mist" className="absolute inset-0">
          <div className="valley-mist absolute inset-x-0 top-[60%] h-[28%]">
            <div className="wisp-track" />
          </div>
          <div className="valley-mist valley-mist-low absolute inset-x-0 top-[74%] h-[26%] lite-hide">
            <div className="wisp-track wisp-track-rev" />
          </div>
        </div>
        <div data-l="birds" className="absolute inset-0">
          <Raven className="bird bird-a" />
          <Raven className="bird bird-b" />
          <Raven className="bird bird-c lite-hide" />
        </div>
        <div data-l="near" className="absolute inset-0">
          <Clouds layers={NEAR_CLOUDS} />
        </div>
        <div className="absolute inset-0 lite-hide">
          {fireflies.map(([left, top, d, t], i) => (
            <span key={i} className="firefly" style={{ left: `${left}%`, top: `${top}%`, "--d": `${d}s`, "--t": `${t}s` } as React.CSSProperties} />
          ))}
        </div>
        {motes.map((m, i) => (
          <span
            key={i}
            className="mote lite-hide"
            style={
              {
                left: `${m.left}%`,
                top: `${m.top}%`,
                width: m.size,
                height: m.size,
                "--d": `${m.delay}s`,
                "--t": `${m.dur}s`,
              } as React.CSSProperties
            }
          />
        ))}
        {/* Readability: soft, local, and only where the text sits. */}
        <div className="hero-read absolute inset-0" />
      </div>

      {/* ---------- Content ---------- */}
      <div
        data-l="content"
        className="hero-content flex min-h-svh items-center justify-center px-6 pt-28 text-center sm:px-10"
      >
        <div className="flex w-full flex-col items-center">
          <p className="reveal hero-intro" style={{ "--i": 0 } as React.CSSProperties}>
            {site.hero.intro}
          </p>

          <h1 id="hero-title" className="mt-[2.2vw] w-full max-lg:mt-4">
            <Wordmark title={site.name} />
          </h1>

          <div className="mx-auto -mt-[0.5vw] w-[min(46rem,70vw)]">
            <WordmarkDivider />
          </div>

          <p className="reveal hero-subtitle mt-4" style={{ "--i": 3 } as React.CSSProperties}>
            {site.hero.subtitle}
          </p>

          <p className="reveal hero-meta mt-5" style={{ "--i": 4 } as React.CSSProperties}>
            <span className="block">
              <time dateTime="2027-02-04">{site.dates}</time>
              <span aria-hidden="true" className="max-lg:hidden"> · </span>
              <span className="max-lg:block">{site.label}</span>
            </span>
            <span className="block opacity-85">
              {site.organiser.university}
              <span aria-hidden="true" className="max-lg:hidden"> · </span>
              <span className="max-lg:block">Venue {site.venue}</span>
            </span>
          </p>

          <Countdown to={site.startsAt} className="reveal mt-5" />

          <div
            className="reveal hero-ctas flex items-center justify-center gap-8"
            style={{ "--i": 5 } as React.CSSProperties}
          >
            {/* "Scroll down to enter the Realm": the words between gold flourish lines, with three
                diamonds below (like the map markers) lighting up one after another, downwards. */}
            <a href={site.hero.enter.href} onClick={(e) => (playSfx("compass"), go(site.hero.enter.href)(e))} className="enter-cue" aria-label={site.hero.enter.label}>
              <span className="enter-cue-kicker" aria-hidden="true">Scroll down</span>
              <span className="enter-cue-row" aria-hidden="true">
                <span className="enter-cue-title">To enter the Realm</span>
              </span>
              <span className="enter-cue-diamonds" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            </a>
          </div>
        </div>
      </div>

      {/* Fest at a glance */}
      <ul className="hero-stats reveal" style={{ "--i": 7 } as React.CSSProperties} aria-label="Fest at a glance">
        {site.stats.map((st, i) => (
          <li key={st.label}>
            {i > 0 && <i aria-hidden="true" className="hero-stats-sep" />}
            <b>{st.value}</b> {st.label}
          </li>
        ))}
      </ul>
    </section>
  );
}
