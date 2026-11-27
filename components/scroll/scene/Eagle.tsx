"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";

/**
 * A soaring eagle built as a small 3D model and projected every frame:
 * wings with dihedral and a flexing wrist, banked thermal circles, occasional
 * wingbeats, and sun/shade on whichever wing surface faces the viewer.
 * Local frame: x = forward, y = left wing, z = up. Half-span = 1.
 */

type V3 = [number, number, number];
type P2 = [number, number];

/** One wing's planform (left wing, y > 0): leading edge → seven primaries → trailing edge. */
const WING: P2[] = [
  [0.1, 0.04], [0.125, 0.2], [0.125, 0.38], [0.105, 0.55], [0.075, 0.7], [0.05, 0.79],
  [0.085, 0.95], [0.04, 0.835], [0.035, 0.99], [0.0, 0.845], [-0.03, 1.0], [-0.04, 0.845],
  [-0.09, 0.975], [-0.08, 0.83], [-0.145, 0.935], [-0.11, 0.81], [-0.185, 0.875], [-0.135, 0.78],
  [-0.165, 0.66], [-0.185, 0.5], [-0.19, 0.34], [-0.175, 0.18], [-0.135, 0.04],
];
/** Body seen from above (z = 0) and in profile (y = 0); both are drawn so it reads from any angle. */
const BODY_TOP: P2[] = [
  [0.34, 0], [0.3, 0.03], [0.24, 0.05], [0.12, 0.07], [-0.1, 0.065], [-0.24, 0.04], [-0.43, 0.1],
  [-0.47, 0.03], [-0.47, -0.03], [-0.43, -0.1], [-0.24, -0.04], [-0.1, -0.065], [0.12, -0.07], [0.24, -0.05], [0.3, -0.03],
];
const BODY_SIDE: P2[] = [
  [0.37, 0.0], [0.33, 0.035], [0.26, 0.055], [0.12, 0.065], [-0.1, 0.05], [-0.26, 0.025], [-0.46, 0.015],
  [-0.46, -0.015], [-0.24, -0.03], [-0.05, -0.075], [0.12, -0.065], [0.26, -0.035], [0.33, -0.012],
];
const BEAK: P2[] = [[0.355, 0.012], [0.41, -0.006], [0.38, -0.03], [0.335, -0.016]];

export type Flight = {
  /** Screen position of the thermal's centre, as fractions of the hero box. */
  cx: number;
  cy: number;
  /** Radius of the circle, as a fraction of hero width. */
  radius: number;
  /** Half-wingspan as a fraction of hero width. */
  size: number;
  /** Seconds per full circle (negative = clockwise). */
  period: number;
  phase: number;
  /** Mix toward the sky colour for distance (0–1). */
  haze: number;
  /** Seconds between bursts of wingbeats. */
  flapEvery: number;
};

const SUN: V3 = (() => { const v: V3 = [-0.45, -0.35, 0.82]; const l = Math.hypot(...v); return v.map((c) => c / l) as V3; })();
const PITCH = 0.42; // camera looks slightly down onto the valley
const FWD: V3 = [0, Math.cos(PITCH), -Math.sin(PITCH)];
const UP: V3 = [0, Math.sin(PITCH), Math.cos(PITCH)];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const rgb = (c: number[]) => `rgb(${c[0]} ${c[1]} ${c[2]})`;
const TOP = [46, 33, 22], TOP_LIT = [116, 84, 52], UNDER = [27, 20, 15], UNDER_LIT = [70, 50, 33], SKY = [150, 152, 164];

export default function Eagle({ flight, className = "" }: { flight: Flight; className?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    const box = svg?.parentElement;
    if (!svg || !box) return;
    const [farW, body, bodySide, beak, nearW] = Array.from(svg.querySelectorAll("path"));
    let W = box.clientWidth, H = box.clientHeight;
    const ro = new ResizeObserver(() => { W = box.clientWidth; H = box.clientHeight; });
    ro.observe(box);

    const dir = Math.sign(flight.period);
    const omega = (Math.PI * 2) / Math.abs(flight.period);

    const draw = (t: number) => {
      const phi = flight.phase + dir * omega * t;
      const R = flight.radius * W, S = flight.size * W, F = W * 2.2;
      // position on a horizontal circle (world: x right, y into the scene, z up)
      const pos: V3 = [R * Math.cos(phi), R * Math.sin(phi), S * 0.25 * Math.sin(t * 0.7)];
      const yaw = phi + (dir * Math.PI) / 2;
      const roll = -dir * (0.38 + 0.05 * Math.sin(t * 0.9)); // bank into the turn
      const pitch = 0.04 * Math.sin(t * 1.1);
      // wingbeats: a short burst of two deep strokes, otherwise a steady glide
      const ft = t % flight.flapEvery;
      const flap = ft < 1.6 ? 0.5 * Math.sin((ft / 0.8) * Math.PI * 2) * Math.sin((ft / 1.6) * Math.PI) : -0.03 + 0.025 * Math.sin(t * 1.7);

      const cr = Math.cos(roll), sr = Math.sin(roll), cp = Math.cos(pitch), sp = Math.sin(pitch), cy = Math.cos(yaw), sy = Math.sin(yaw);
      const toWorld = (v: V3): V3 => {
        let [x, y, z] = v;
        [y, z] = [y * cr - z * sr, y * sr + z * cr];
        [x, z] = [x * cp + z * sp, -x * sp + z * cp];
        [x, y] = [x * cy - y * sy, x * sy + y * cy];
        return [pos[0] + x * S, pos[1] + y * S, pos[2] + z * S];
      };
      const project = (w: V3): P2 => {
        const depth = dot(w, FWD);
        const k = F / (F + depth);
        return [flight.cx * W + w[0] * k, flight.cy * H - dot(w, UP) * k];
      };
      // wing articulation: dihedral + flap at the shoulder, extra flex at the wrist
      const wingPoint = ([x, u]: P2, side: 1 | -1): V3 => {
        const a1 = 0.14 + flap;
        const a2 = a1 + flap * 0.7 - 0.05;
        const sweep = -0.05 * flap * Math.max(0, u - 0.5);
        if (u <= 0.55) return [x + sweep, side * u * Math.cos(a1), u * Math.sin(a1)];
        const wy = 0.55 * Math.cos(a1), wz = 0.55 * Math.sin(a1), d = u - 0.55;
        return [x + sweep, side * (wy + d * Math.cos(a2)), wz + d * Math.sin(a2)];
      };
      const path = (pts: P2[]) => "M" + pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("L") + "Z";

      const wings = ([1, -1] as const).map((side) => {
        const world = WING.map((p) => toWorld(wingPoint(p, side)));
        // surface normal from shoulder-lead, tip, shoulder-trail
        let n = cross(sub(world[8], world[0]), sub(world[22], world[0]));
        const l = Math.hypot(...n) || 1;
        n = n.map((c) => c / l) as V3;
        if (side === -1) n = n.map((c) => -c) as V3;
        const facing = -dot(n, FWD); // > 0: we see the upper surface
        const surfN = facing > 0 ? n : (n.map((c) => -c) as V3);
        const lit = Math.max(0, dot(surfN, SUN));
        const base = facing > 0 ? mix(TOP, TOP_LIT, lit * 0.75) : mix(UNDER, UNDER_LIT, lit * 0.5 + 0.15);
        const depth = world.reduce((s, w) => s + dot(w, FWD), 0) / world.length;
        return { d: path(world.map(project)), fill: rgb(mix(base, SKY, flight.haze)), depth };
      });
      wings.sort((a, b) => b.depth - a.depth);
      farW.setAttribute("d", wings[0].d); farW.setAttribute("fill", wings[0].fill);
      nearW.setAttribute("d", wings[1].d); nearW.setAttribute("fill", wings[1].fill);
      const bodyFill = rgb(mix([44, 31, 21], SKY, flight.haze));
      body.setAttribute("d", path(BODY_TOP.map(([x, y]) => project(toWorld([x, y, 0])))));
      bodySide.setAttribute("d", path(BODY_SIDE.map(([x, z]) => project(toWorld([x, 0, z])))));
      body.setAttribute("fill", bodyFill);
      bodySide.setAttribute("fill", bodyFill);
      beak.setAttribute("d", path(BEAK.map(([x, z]) => project(toWorld([x, 0, z])))));
    };

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let t = 0;
    draw(t);
    if (reduced) return () => ro.disconnect();
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(box);
    const tick = (_time: number, deltaMs: number) => {
      if (!visible) return;
      t += Math.min(0.05, deltaMs / 1000);
      draw(t);
    };
    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
      io.disconnect();
      ro.disconnect();
    };
  }, [flight]);

  return (
    <svg ref={svgRef} className={`eagle ${className}`} aria-hidden="true" focusable="false">
      <path />
      <path />
      <path />
      <path fill="#c99a3a" />
      <path />
    </svg>
  );
}
