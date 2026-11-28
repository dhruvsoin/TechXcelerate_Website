"use client";

/**
 * The realm's sound, synthesised live with the Web Audio API — no audio files, nothing to license.
 * Off by default; it starts only when the visitor turns sound on (a click), and goes quiet when
 * the tab is hidden.
 *
 *  Beds (follow the scroll):  valley wind, birdsong and eagle cries on the hero → a warm swell as the
 *                             camera pushes into the castle → high, airy wind and distant surf over the map.
 *  Moments:                   a warm chord as the kingdom appears (and again at the finale), a glassy
 *                             shimmer while the golden path draws, a rising bell at each location
 *                             (the ten stops play a little tune), parchment for the details panel,
 *                             a wax seal for Register, the compass ring for Enter the Realm, a brass
 *                             tick on hover.
 *  Locations:                 each landmark has its own ambience (waves and gulls, a fountain, a market…).
 *
 * Nothing violent: no blades, battle horns, war drums or fire.
 */
import { realmStore, type RealmState } from "@/components/realm/realm-store";
import { EVENTS } from "@/content/events";
import type { LandmarkKey } from "@/content/realm-map";

type Voice = { out: GainNode; stop: () => void };
type NoiseKind = "white" | "pink" | "brown";
export type Sfx = "compass" | "seal" | "tick";

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Arrival bells: D major pentatonic, rising with each location along the route. */
const ARRIVAL = [293.66, 329.63, 369.99, 440, 493.88, 587.33, 659.26, 739.99, 880, 987.77];
const SPARKLE = [1174.66, 1318.51, 1479.98, 1760, 1975.53, 2349.32];

class RealmAudio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private verbIn!: GainNode;
  private noise = {} as Record<NoiseKind, AudioBuffer>;
  private hero: Voice | null = null;
  private sky: Voice | null = null;
  private mist: { voice: Voice; lp: BiquadFilterNode } | null = null;
  private ambience: { key: LandmarkKey; voice: Voice } | null = null;
  private unsub: (() => void) | null = null;
  private prev: RealmState | null = null;
  private enabled = false;
  private t = 0;
  private lastPath = 0;
  private sparkleAcc = 0;
  private lastSparkle = 0;
  private chordArmed = true;
  private finaleArmed = true;
  private lastTick = 0;

  get on() {
    return this.enabled;
  }

  // ---------------------------------------------------------------- lifecycle
  async enable() {
    if (!this.ctx) this.build();
    const ctx = this.ctx!;
    await ctx.resume();
    this.enabled = true;
    this.master.gain.cancelScheduledValues(ctx.currentTime);
    this.master.gain.setTargetAtTime(0.55, ctx.currentTime, 0.6);
    this.prev = realmStore.get();
    this.unsub ??= realmStore.subscribe(() => this.onState());
    this.mix(0.4);
    const s = realmStore.get();
    if (s.arrived && s.active >= 0) this.setAmbience(EVENTS[s.active].landmark);
  }

  disable() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    this.enabled = false;
    this.master.gain.cancelScheduledValues(ctx.currentTime);
    this.master.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
    this.unsub?.();
    this.unsub = null;
    this.setAmbience(null);
    setTimeout(() => !this.enabled && ctx.state === "running" && ctx.suspend(), 1400);
  }

  private build() {
    const ctx = new AudioContext();
    this.ctx = ctx;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -16;
    limiter.knee.value = 10;
    limiter.ratio.value = 6;
    limiter.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(limiter);

    // shared reverb (a generated hall impulse) for bells, chords and distant calls
    const verb = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 3.2);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        lp += 0.35 * (Math.random() * 2 - 1 - lp);
        d[i] = lp * Math.exp((-i / ctx.sampleRate) * 2.1);
      }
    }
    verb.buffer = ir;
    this.verbIn = ctx.createGain();
    this.verbIn.gain.value = 0.55;
    this.verbIn.connect(verb).connect(this.master);

    for (const kind of ["white", "pink", "brown"] as const) this.noise[kind] = this.makeNoise(kind);

    this.hero = this.heroBed();
    this.sky = this.skyBed();
    this.mist = this.mistBed();

    document.addEventListener("visibilitychange", () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend();
      else if (this.enabled) this.ctx.resume();
    });
  }

  // ---------------------------------------------------------------- inputs from the page
  /** Realm timeline position, 0–100 (scroll %). Mixes the beds and fires the reveal chords. */
  progress(t: number) {
    this.t = t;
    if (!this.enabled) return;
    this.mix(0.25);
    // the kingdom chord lands on the castle match-cut (timeline 7.5)
    if (this.chordArmed && t >= 7.5 && t < 30) {
      this.chordArmed = false;
      this.chord(1);
    }
    if (t < 5) this.chordArmed = true;
    if (this.finaleArmed && t >= 93.5) {
      this.finaleArmed = false;
      this.chord(0.7);
    }
    if (t < 90) this.finaleArmed = true;
  }

  /** Golden path progress 0–1: a glassy shimmer follows the line while it draws. */
  path(p: number) {
    const dp = p - this.lastPath;
    this.lastPath = p;
    if (!this.enabled || dp <= 0) return;
    this.sparkleAcc += dp;
    const now = performance.now();
    while (this.sparkleAcc > 0.006) {
      this.sparkleAcc -= 0.006;
      if (now - this.lastSparkle < 45) continue;
      this.lastSparkle = now;
      const c = this.ctx!;
      this.bell(pick(SPARKLE), c.currentTime + rand(0, 0.05), { gain: 0.022, decay: 1.1, ratios: [1, 2.76, 5.4], pan: rand(-0.6, 0.6), verb: 0.7 });
    }
  }

  play(name: Sfx) {
    if (!this.enabled || !this.ctx) return;
    if (name === "tick") this.tick();
    if (name === "compass") this.compass();
    if (name === "seal") this.seal();
  }

  private onState() {
    const s = realmStore.get();
    const p = this.prev ?? s;
    this.prev = s;
    if (!this.enabled) return;
    if (s.hover >= 0 && s.hover !== p.hover) this.tick();
    if (s.arrived && s.active >= 0 && (!p.arrived || s.active !== p.active)) {
      const c = this.ctx!;
      const f = ARRIVAL[s.active % ARRIVAL.length];
      this.bell(f, c.currentTime + 0.02, { gain: 0.16, decay: 3.4, verb: 0.6 });
      this.bell(f * 2, c.currentTime + 0.03, { gain: 0.045, decay: 2.2, verb: 0.6 });
      this.setAmbience(EVENTS[s.active].landmark);
    } else if (!s.arrived && p.arrived) this.setAmbience(null);
    if (s.detailsOpen !== p.detailsOpen) this.parchment(s.detailsOpen);
  }

  private mix(tc: number) {
    const c = this.ctx;
    if (!c) return;
    const now = c.currentTime, t = this.t;
    // the valley fades as the camera pushes in; the swell peaks at the cut (7.5) as the glow fills the screen
    const heroLvl = 1 - smooth(3, 8, t);
    const skyLvl = smooth(7.5, 14, t);
    const mistLvl = smooth(2, 7.5, t) * (1 - smooth(7.5, 12, t));
    this.hero?.out.gain.setTargetAtTime(heroLvl * 0.9, now, tc);
    this.sky?.out.gain.setTargetAtTime(skyLvl * (this.ambience ? 0.45 : 0.8), now, tc);
    if (this.mist) {
      this.mist.voice.out.gain.setTargetAtTime(mistLvl * 0.42, now, tc * 0.6);
      this.mist.lp.frequency.setTargetAtTime(280 + 2600 * mistLvl, now, tc * 0.6);
    }
  }

  // ---------------------------------------------------------------- building blocks
  private makeNoise(kind: NoiseKind) {
    const c = this.ctx!;
    const len = c.sampleRate * 4;
    const buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        if (kind === "white") d[i] = w * 0.5;
        else if (kind === "pink") {
          b0 = 0.99765 * b0 + w * 0.099046;
          b1 = 0.963 * b1 + w * 0.2965164;
          b2 = 0.57 * b2 + w * 1.0526913;
          d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.11;
        } else {
          last = (last + 0.02 * w) / 1.02;
          d[i] = last * 3.2;
        }
      }
    }
    return buf;
  }

  private src(kind: NoiseKind) {
    const c = this.ctx!;
    const s = c.createBufferSource();
    s.buffer = this.noise[kind];
    s.loop = true;
    s.start(0, rand(0, 3.9));
    return s;
  }

  private filter(type: BiquadFilterType, freq: number, q = 0.7) {
    const f = this.ctx!.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  }

  private gain(v = 0) {
    const g = this.ctx!.createGain();
    g.gain.value = v;
    return g;
  }

  private panner(v: number) {
    const p = this.ctx!.createStereoPanner();
    p.pan.value = v;
    return p;
  }

  /** A voice: an output gain plus everything it owns (sources, timers), stopped together. */
  private voice(build: (out: GainNode, own: (stop: () => void) => void, every: (min: number, max: number, fn: () => void) => void) => void, level = 0): Voice {
    const out = this.gain(level);
    out.connect(this.master);
    const stops: (() => void)[] = [];
    const own = (s: () => void) => stops.push(s);
    const every = (min: number, max: number, fn: () => void) => {
      let id: ReturnType<typeof setTimeout>;
      const tick = () => {
        if (this.ctx?.state === "running") fn();
        id = setTimeout(tick, rand(min, max));
      };
      id = setTimeout(tick, rand(min * 0.25, max * 0.6));
      own(() => clearTimeout(id));
    };
    build(out, own, every);
    return {
      out,
      stop: () => {
        stops.forEach((s) => {
          try {
            s();
          } catch {
            /* already stopped */
          }
        });
        out.disconnect();
      },
    };
  }

  /** Continuous noise layer: kind → filters → gain → dest. Returns the gain for modulation. */
  private layer(own: (s: () => void) => void, dest: AudioNode, kind: NoiseKind, filters: BiquadFilterNode[], level: number) {
    const s = this.src(kind);
    const g = this.gain(level);
    let node: AudioNode = s;
    for (const f of filters) node = node.connect(f);
    node.connect(g).connect(dest);
    own(() => s.stop());
    return g;
  }

  /** Additive bell: partial ratios with shortening decays. */
  private bell(freq: number, when: number, o: { gain: number; decay: number; ratios?: number[]; pan?: number; verb?: number }) {
    const c = this.ctx!;
    const ratios = o.ratios ?? [1, 2, 3.01, 4.17, 5.43];
    const out = this.gain(o.gain);
    const pan = this.panner(o.pan ?? 0);
    out.connect(pan).connect(this.master);
    if (o.verb) {
      const send = this.gain(o.verb);
      out.connect(send).connect(this.verbIn);
    }
    ratios.forEach((r, i) => {
      const osc = c.createOscillator();
      osc.frequency.value = freq * r * (1 + (Math.random() - 0.5) * 0.003);
      const g = this.gain();
      const d = o.decay / (1 + i * 0.6);
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(1 / (i + 1) ** 1.1, when + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, when + d);
      osc.connect(g).connect(out);
      osc.start(when);
      osc.stop(when + d + 0.05);
    });
    setTimeout(() => out.disconnect(), (when - c.currentTime + o.decay + 0.3) * 1000);
  }

  /** A short filtered noise burst with an attack/decay envelope. */
  private burst(kind: NoiseKind, when: number, dur: number, peak: number, f: BiquadFilterNode, dest: AudioNode, attack = 0.005) {
    const c = this.ctx!;
    const s = c.createBufferSource();
    s.buffer = this.noise[kind];
    const g = this.gain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(peak, when + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    s.connect(f).connect(g).connect(dest);
    s.start(when, rand(0, 3));
    s.stop(when + dur + 0.05);
  }

  // ---------------------------------------------------------------- creatures
  private chirp(dest: AudioNode, trill = false) {
    const c = this.ctx!;
    const t0 = c.currentTime + 0.05;
    const pan = this.panner(rand(-0.8, 0.8));
    pan.connect(dest);
    const notes = 2 + Math.floor(Math.random() * 3);
    const base = rand(2400, 3600);
    for (let i = 0; i < notes; i++) {
      const o = c.createOscillator();
      const g = this.gain();
      const s = t0 + i * rand(0.13, 0.18);
      o.frequency.setValueAtTime(base, s);
      o.frequency.exponentialRampToValueAtTime(base * 1.45, s + 0.05);
      o.frequency.exponentialRampToValueAtTime(base * 1.1, s + 0.1);
      if (trill) {
        const lfo = c.createOscillator();
        const amt = this.gain(320);
        lfo.frequency.value = rand(24, 34);
        lfo.connect(amt).connect(o.frequency);
        lfo.start(s);
        lfo.stop(s + 0.13);
      }
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(0.035, s + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.11);
      o.connect(g).connect(pan);
      o.start(s);
      o.stop(s + 0.13);
    }
  }

  /** A distant eagle: two short "kee" notes and a long falling cry, softened by the reverb. */
  private eagle(dest: AudioNode) {
    const c = this.ctx!;
    const t0 = c.currentTime + 0.05;
    const pan = this.panner(rand(-0.7, 0.7));
    const bp = this.filter("bandpass", 2100, 2.5);
    const out = this.gain(0.06);
    out.connect(pan).connect(dest);
    const send = this.gain(0.9);
    out.connect(send).connect(this.verbIn);
    bp.connect(out);
    const call = (s: number, f0: number, f1: number, dur: number) => {
      const o = c.createOscillator();
      o.type = "sawtooth";
      const vib = c.createOscillator();
      const va = this.gain(45);
      vib.frequency.value = 17;
      vib.connect(va).connect(o.frequency);
      o.frequency.setValueAtTime(f0, s);
      o.frequency.exponentialRampToValueAtTime(f1, s + dur);
      const g = this.gain();
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(1, s + 0.04);
      g.gain.setTargetAtTime(0, s + dur * 0.6, dur * 0.25);
      o.connect(g).connect(bp);
      o.start(s);
      vib.start(s);
      o.stop(s + dur + 0.3);
      vib.stop(s + dur + 0.3);
    };
    call(t0, 2600, 2250, 0.12);
    call(t0 + 0.2, 2650, 2300, 0.12);
    call(t0 + 0.42, 2500, 1650, 0.95);
    setTimeout(() => out.disconnect(), 2500);
  }

  private gull(dest: AudioNode) {
    const c = this.ctx!;
    const pan = this.panner(rand(-0.8, 0.8));
    const bp = this.filter("bandpass", 1250, 2);
    const out = this.gain(0.045);
    bp.connect(out).connect(pan).connect(dest);
    const send = this.gain(0.5);
    out.connect(send).connect(this.verbIn);
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const s = c.currentTime + 0.05 + i * rand(0.38, 0.5);
      const o = c.createOscillator();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(rand(1450, 1650), s);
      o.frequency.exponentialRampToValueAtTime(rand(880, 980), s + 0.3);
      const g = this.gain();
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(1, s + 0.03);
      g.gain.setTargetAtTime(0, s + 0.18, 0.07);
      o.connect(g).connect(bp);
      o.start(s);
      o.stop(s + 0.6);
    }
    setTimeout(() => out.disconnect(), 3500);
  }

  // ---------------------------------------------------------------- beds
  private heroBed() {
    return this.voice((out, own, every) => {
      // wind through high pines: moving band-pass with slow gusts
      const bp = this.filter("bandpass", 420, 0.6);
      const wind = this.layer(own, out, "brown", [bp], 0.42);
      const c = this.ctx!;
      const lfo = c.createOscillator();
      lfo.frequency.value = 0.07;
      const amt = this.gain(220);
      lfo.connect(amt).connect(bp.frequency);
      const gust = c.createOscillator();
      gust.frequency.value = 0.11;
      const gamt = this.gain(0.2);
      gust.connect(gamt).connect(wind.gain);
      lfo.start();
      gust.start();
      own(() => lfo.stop());
      own(() => gust.stop());
      every(3500, 9000, () => this.chirp(out));
      every(18000, 34000, () => this.eagle(out));
    });
  }

  private skyBed() {
    return this.voice((out, own, every) => {
      // high, airy wind above the clouds
      const hp = this.filter("highpass", 380);
      const bp = this.filter("bandpass", 900, 0.45);
      const air = this.layer(own, out, "pink", [hp, bp], 0.5);
      every(2500, 6000, () => {
        const c = this.ctx!;
        air.gain.setTargetAtTime(rand(0.3, 0.7), c.currentTime, 1.6);
        bp.frequency.setTargetAtTime(rand(650, 1300), c.currentTime, 2);
      });
      // distant surf far below
      this.surf(out, own, every, 0.35);
      // a village bell somewhere in the kingdom, now and then
      every(26000, 48000, () => {
        const c = this.ctx!;
        const f = pick([392, 440, 349.23]);
        this.bell(f, c.currentTime + 0.05, { gain: 0.03, decay: 4, pan: rand(-0.7, 0.7), verb: 0.9 });
        this.bell(f, c.currentTime + 1.3, { gain: 0.025, decay: 4, pan: rand(-0.7, 0.7), verb: 0.9 });
      });
    });
  }

  private mistBed() {
    let lp!: BiquadFilterNode;
    const voice = this.voice((out, own) => {
      lp = this.filter("lowpass", 300, 0.5);
      this.layer(own, out, "pink", [lp], 0.9);
      const air = this.filter("highpass", 2400);
      this.layer(own, out, "white", [air], 0.05);
    });
    return { voice, lp };
  }

  /** Waves: swelling brown noise whose filter opens at each crest, with a fizz as it breaks. */
  private surf(dest: AudioNode, own: (s: () => void) => void, every: (a: number, b: number, fn: () => void) => void, level: number) {
    const lp = this.filter("lowpass", 380, 0.4);
    const g = this.layer(own, dest, "brown", [lp], level * 0.25);
    const hp = this.filter("highpass", 2600);
    const fizz = this.layer(own, dest, "white", [hp], 0);
    every(6500, 9500, () => {
      const c = this.ctx!;
      const now = c.currentTime;
      g.gain.setTargetAtTime(level, now, 1.1);
      lp.frequency.setTargetAtTime(1500, now, 1.1);
      g.gain.setTargetAtTime(level * 0.22, now + 3, 1.6);
      lp.frequency.setTargetAtTime(360, now + 3, 1.8);
      fizz.gain.setTargetAtTime(level * 0.12, now + 2.6, 0.25);
      fizz.gain.setTargetAtTime(0, now + 3.4, 0.9);
    });
  }

  // ---------------------------------------------------------------- location ambiences
  private setAmbience(key: LandmarkKey | null) {
    const c = this.ctx;
    if (!c || this.ambience?.key === key) return;
    const old = this.ambience;
    if (old) {
      old.voice.out.gain.setTargetAtTime(0, c.currentTime, 0.7);
      setTimeout(() => old.voice.stop(), 3200);
    }
    this.ambience = null;
    if (key && this.enabled) {
      const voice = this.place(key);
      voice.out.gain.setTargetAtTime(1, c.currentTime, 0.9);
      this.ambience = { key, voice };
    }
    this.mix(0.8);
  }

  private place(key: LandmarkKey): Voice {
    return this.voice((out, own, every) => {
      const c = () => this.ctx!;
      const fountain = (level: number) => {
        const hp = this.filter("highpass", 900);
        const bp = this.filter("bandpass", 3200, 0.5);
        const g = this.layer(own, out, "white", [hp, bp], level);
        const low = this.layer(own, out, "pink", [this.filter("bandpass", 700, 0.8)], level * 0.5);
        every(70, 140, () => {
          g.gain.setTargetAtTime(level * rand(0.6, 1.25), c().currentTime, 0.04);
          low.gain.setTargetAtTime(level * rand(0.3, 0.7), c().currentTime, 0.06);
        });
      };
      const murmur = (voices: number, level: number, verb = 0) => {
        for (let i = 0; i < voices; i++) {
          const bp = this.filter("bandpass", rand(380, 820), 3);
          const pan = this.panner(rand(-0.8, 0.8));
          pan.connect(out);
          if (verb) pan.connect(this.gain(verb)).connect(this.verbIn);
          const g = this.layer(own, pan, "pink", [bp], 0);
          every(110, 260, () => {
            const on = Math.random() < 0.7;
            g.gain.setTargetAtTime(on ? level * rand(0.4, 1) : 0, c().currentTime, 0.04);
            bp.frequency.setTargetAtTime(rand(380, 900), c().currentTime, 0.05);
          });
        }
      };
      switch (key) {
        case "lighthouse": // waves and gulls
          this.surf(out, own, every, 0.7);
          every(5000, 12000, () => this.gull(out));
          break;
        case "garden": // fountain and songbirds
          fountain(0.12);
          every(1800, 4200, () => this.chirp(out, Math.random() < 0.4));
          break;
        case "palace": // the great fountain
          fountain(0.16);
          every(5000, 11000, () => this.chirp(out));
          break;
        case "village": // market chatter and a bell
          murmur(5, 0.16);
          every(14000, 26000, () => {
            this.bell(293.66, c().currentTime + 0.05, { gain: 0.06, decay: 4.5, verb: 0.7, pan: 0.3 });
            this.bell(293.66, c().currentTime + 1.4, { gain: 0.05, decay: 4.5, verb: 0.7, pan: 0.3 });
          });
          break;
        case "library": // pages turning in a quiet hall
          this.layer(own, out, "brown", [this.filter("lowpass", 220)], 0.18);
          every(3500, 8500, () => {
            const now = c().currentTime;
            const pan = this.panner(rand(-0.5, 0.5));
            pan.connect(out);
            this.burst("white", now, 0.16, 0.22, this.filter("bandpass", 2600, 0.7), pan, 0.03);
            this.burst("white", now + 0.14, 0.24, 0.3, this.filter("bandpass", 3400, 0.6), pan, 0.04);
            this.burst("pink", now + 0.05, 0.35, 0.12, this.filter("lowpass", 1400), pan, 0.08);
          });
          break;
        case "workshop": { // a creaking water wheel and running water
          const bp = this.filter("bandpass", 1300, 1.1);
          const water = this.layer(own, out, "white", [bp], 0.08);
          every(60, 120, () => water.gain.setTargetAtTime(rand(0.04, 0.13), c().currentTime, 0.03));
          every(1200, 1400, () => {
            const now = c().currentTime;
            const o = c().createOscillator();
            o.type = "sawtooth";
            o.frequency.setValueAtTime(rand(78, 92), now);
            o.frequency.linearRampToValueAtTime(rand(104, 118), now + 0.45);
            const res = this.filter("bandpass", rand(650, 900), 9);
            const g = this.gain();
            g.gain.setValueAtTime(0, now);
            g.gain.linearRampToValueAtTime(0.11, now + 0.12);
            g.gain.setTargetAtTime(0, now + 0.4, 0.08);
            o.connect(res).connect(g).connect(out);
            o.start(now);
            o.stop(now + 0.9);
            this.burst("brown", now + 0.55, 0.3, 0.12, this.filter("lowpass", 900), out, 0.02); // paddle splash
          });
          break;
        }
        case "observatory": { // night crickets and a wind chime
          for (const [f, p] of [[4400, -0.5], [4750, 0.6]] as const) {
            const o = c().createOscillator();
            o.frequency.value = f;
            const g = this.gain(0);
            o.connect(g).connect(this.panner(p)).connect(out);
            o.start();
            own(() => o.stop());
            every(650, 1100, () => {
              const now = c().currentTime;
              for (let k = 0; k < 3; k++) {
                const s = now + k * 0.05;
                g.gain.setValueAtTime(0, s);
                g.gain.linearRampToValueAtTime(0.018, s + 0.006);
                g.gain.linearRampToValueAtTime(0, s + 0.024);
              }
            });
          }
          every(2800, 6500, () => {
            const n = 1 + Math.floor(Math.random() * 3);
            for (let k = 0; k < n; k++) this.bell(pick(SPARKLE) * pick([1, 0.5]), c().currentTime + k * rand(0.15, 0.4), { gain: 0.035, decay: 2.4, ratios: [1, 2.76, 5.4], pan: rand(-0.6, 0.6), verb: 0.6 });
          });
          break;
        }
        case "castle": { // high wind and flags snapping
          const bp = this.filter("bandpass", 900, 1.4);
          const wind = this.layer(own, out, "pink", [bp], 0.25);
          every(1500, 3200, () => {
            wind.gain.setTargetAtTime(rand(0.15, 0.45), c().currentTime, 0.8);
            bp.frequency.setTargetAtTime(rand(600, 1400), c().currentTime, 0.9);
          });
          every(1400, 3200, () => {
            const now = c().currentTime;
            const n = 6 + Math.floor(Math.random() * 9);
            let s = now;
            for (let k = 0; k < n; k++) {
              s += rand(0.065, 0.11);
              this.burst("white", s, 0.04, rand(0.05, 0.1), this.filter("bandpass", rand(900, 1300), 0.9), out, 0.003);
            }
          });
          break;
        }
        case "exhibition": // an echoing hall murmur
          murmur(7, 0.1, 0.9);
          this.layer(own, out, "brown", [this.filter("lowpass", 260)], 0.12);
          break;
        case "citadel": { // the clock-tower bell
          const toll = (delay: number) => this.bell(196, c().currentTime + delay, { gain: 0.12, decay: 7, ratios: [0.5, 1, 1.19, 1.5, 2, 2.51, 3.01], verb: 0.8 });
          [0.4, 3, 5.6].forEach(toll);
          every(22000, 30000, () => toll(0.05));
          every(5000, 10000, () => this.chirp(out));
          break;
        }
      }
    });
  }

  // ---------------------------------------------------------------- moments
  /** A low, warm chord as the kingdom appears. */
  private chord(level: number) {
    const c = this.ctx!;
    const now = c.currentTime;
    const lp = this.filter("lowpass", 500, 0.6);
    lp.frequency.setValueAtTime(500, now);
    lp.frequency.linearRampToValueAtTime(1500, now + 3);
    const out = this.gain();
    out.gain.setValueAtTime(0, now);
    out.gain.linearRampToValueAtTime(0.12 * level, now + 2.4);
    out.gain.setValueAtTime(0.12 * level, now + 4.2);
    out.gain.exponentialRampToValueAtTime(0.0001, now + 10);
    lp.connect(out).connect(this.master);
    out.connect(this.gain(0.8)).connect(this.verbIn);
    for (const f of [73.42, 110, 146.83, 185, 220, 329.63]) {
      for (const det of [-6, 6]) {
        const o = c.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = f;
        o.detune.value = det;
        const g = this.gain(f > 200 ? 0.09 : 0.14);
        o.connect(g).connect(lp);
        o.start(now);
        o.stop(now + 10.2);
      }
    }
    setTimeout(() => out.disconnect(), 10600);
  }

  private tick() {
    const now = performance.now();
    if (now - this.lastTick < 60) return;
    this.lastTick = now;
    const c = this.ctx!;
    const t = c.currentTime;
    const o = c.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(2500, t);
    o.frequency.exponentialRampToValueAtTime(1800, t + 0.03);
    const g = this.gain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.13, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.1);
    this.burst("white", t, 0.018, 0.12, this.filter("highpass", 3500), this.master, 0.001);
  }

  /** Turning the compass ring: a ratchet of brass clicks and a soft metallic ring. */
  private compass() {
    const c = this.ctx!;
    const t = c.currentTime;
    [2600, 2350, 2750, 2300, 2500].forEach((f, i) => {
      const s = t + i * 0.055;
      const o = c.createOscillator();
      o.type = "triangle";
      o.frequency.setValueAtTime(f, s);
      o.frequency.exponentialRampToValueAtTime(f * 0.75, s + 0.03);
      const g = this.gain();
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(0.06, s + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.06);
      o.connect(g).connect(this.master);
      o.start(s);
      o.stop(s + 0.08);
      this.burst("white", s, 0.012, 0.04, this.filter("highpass", 3500), this.master, 0.001);
    });
    this.bell(880, t + 0.3, { gain: 0.05, decay: 2.2, ratios: [1, 2.76, 5.4, 8.93], verb: 0.5 });
    this.bell(587.33, t + 0.3, { gain: 0.06, decay: 3, verb: 0.6 });
  }

  /** Pressing a wax seal: a soft thump, a squish, then a small chime. */
  private seal() {
    const c = this.ctx!;
    const t = c.currentTime;
    const o = c.createOscillator();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(52, t + 0.18);
    const g = this.gain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.32, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.4);
    this.burst("brown", t + 0.01, 0.25, 0.14, this.filter("lowpass", 800), this.master, 0.01);
    this.bell(587.33, t + 0.16, { gain: 0.08, decay: 2.8, verb: 0.6 });
    this.bell(880, t + 0.22, { gain: 0.05, decay: 2.4, verb: 0.6 });
  }

  /** Parchment: a crackly unroll when the details open, a shorter fold when they close. */
  private parchment(open: boolean) {
    const c = this.ctx!;
    const t = c.currentTime;
    const dur = open ? 0.75 : 0.42;
    const grains = open ? 42 : 22;
    // crackle: dense, bright paper fibres giving way
    for (let i = 0; i < grains; i++) {
      const s = t + (i / grains) ** 0.8 * dur + rand(0, 0.012);
      this.burst("white", s, rand(0.006, 0.02), rand(0.22, 0.5), this.filter("bandpass", rand(1600, 5200), 1.2), this.master, 0.001);
    }
    // body: the sheet sliding, a band of noise sweeping up (open) or down (close)
    const bp = this.filter("bandpass", open ? 900 : 3200, 0.8);
    bp.frequency.setValueAtTime(open ? 900 : 3200, t);
    bp.frequency.exponentialRampToValueAtTime(open ? 3600 : 800, t + dur);
    this.burst("pink", t, dur, 0.55, bp, this.master, dur * 0.35);
    // a soft settle at the end
    this.burst("brown", t + dur * 0.85, 0.18, 0.16, this.filter("lowpass", 600), this.master, 0.01);
  }
}

/** The single shared instance (client only). */
export const realmAudio: RealmAudio | null = typeof window === "undefined" ? null : new RealmAudio();

/** Fire a one-off sound if sound is on (safe to call anywhere). */
export function playSfx(name: Sfx) {
  realmAudio?.play(name);
}
