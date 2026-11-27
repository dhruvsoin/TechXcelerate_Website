"use client";

import { useSyncExternalStore } from "react";

/** One shared one-second clock for the page. */
let listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let now = 0;
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  if (!timer) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      listeners.forEach((l) => l());
    }, 1000);
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
      listeners = new Set();
    }
  };
};
const getNow = () => now || Date.now();
const getServerNow = () => 0; // server renders placeholders; the client fills in

const pad = (n: number) => String(n).padStart(2, "0");

/** Live Days / Hours / Min / Sec to the opening of the fest. */
export default function Countdown({ to, className = "" }: { to: string; className?: string }) {
  const t = useSyncExternalStore(subscribe, getNow, getServerNow);
  const target = new Date(to).getTime();
  const left = Math.max(0, target - t);
  const ready = t !== 0;
  const parts = [
    { v: Math.floor(left / 86400000), l: "Days" },
    { v: Math.floor(left / 3600000) % 24, l: "Hours" },
    { v: Math.floor(left / 60000) % 60, l: "Min" },
    { v: Math.floor(left / 1000) % 60, l: "Sec" },
  ];

  if (ready && left === 0) {
    return <p className={`countdown-live ${className}`}>The fest has begun</p>;
  }

  return (
    <div className={`countdown ${className}`} role="timer" aria-label={ready ? `${parts[0].v} days ${parts[1].v} hours until TechXcelerate` : "Countdown to TechXcelerate"}>
      {parts.map((p) => (
        <div key={p.l} className="countdown-cell" aria-hidden="true">
          <b>{ready ? (p.l === "Days" ? p.v : pad(p.v)) : "--"}</b>
          <i>{p.l}</i>
        </div>
      ))}
    </div>
  );
}
