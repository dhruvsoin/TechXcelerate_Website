"use client";

import { useState } from "react";
import { realmAudio } from "@/components/sound/realm-audio";

/**
 * Sound on/off. All sound is synthesised live (see components/sound/realm-audio.ts) — no audio
 * files. Off by default; it starts only on this click, as browsers require.
 */
export default function SoundToggle() {
  const [on, setOn] = useState(false);

  const toggle = async () => {
    const next = !on;
    setOn(next);
    try {
      if (next) await realmAudio?.enable();
      else realmAudio?.disable();
    } catch {
      setOn(false); // audio unavailable in this browser
    }
  };

  return (
    <button type="button" className={`sound-toggle ${on ? "is-on" : ""}`} aria-pressed={on} onClick={toggle}>
      <span className="sound-bars" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      <span>Sound · {on ? "On" : "Off"}</span>
    </button>
  );
}
