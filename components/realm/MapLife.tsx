"use client";

import { useEffect, useRef } from "react";
import { EVENTS } from "@/content/events";
import { LANDMARKS, PATHWAY, REALM_MAP } from "@/content/realm-map";
import { detectMotionMode } from "@/components/scroll/SmoothScroll";
import { realmCamera } from "./realm-store";

/**
 * Live effects over the realm map, drawn by one small WebGL pass in screen space. It follows the
 * camera at any zoom, so it costs the same at every zoom level and the map image keeps its full quality:
 *
 *  - Sun glints sparkling and drifting on the sea, and surf lines rolling in against every coast.
 *  - Soft cloud shadows drifting across land and sea.
 *  - A faint wind ripple over the forest canopy.
 *  - Lit windows twinkling at each of the ten locations.
 *  - The lighthouse beam sweeping over the water, and chimney smoke rising from the village.
 *
 * On a 2D layer above it, the "Living kingdom": ships crossing the bays with a wake, a flock of birds
 * passing over now and then with their shadows on the ground, a pennant in the fest colours above
 * each location, and a lantern procession walking the part of the golden path drawn so far.
 *
 * Where the sea, coast and forests are comes from the map image itself: it's read once, at low
 * resolution, into a small mask texture (sea, forest, and a blurred sea channel used as a rough
 * distance from the coast; the sea is the bluish area connected to the map's edges). Off for reduced
 * motion, lighter on low-power devices, and paused whenever the map isn't on screen.
 */

const MASK_W = 720, MASK_H = 450;

const VERT = `
attribute vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D u_mask;
uniform vec2 u_view;   // stage size, CSS px
uniform float u_scale; // device px per CSS px for this canvas
uniform vec4 u_cam;    // map offset (x, y) and on-screen size (w, h), CSS px
uniform float u_t;
uniform vec2 u_lm[10]; // the ten locations, map uv
uniform vec2 u_light;  // lighthouse
uniform vec2 u_smoke;  // village

float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * n(p); p = p * 2.02 + vec2(3.1, 7.7); a *= 0.5; }
  return s;
}

void main() {
  vec2 css = vec2(gl_FragCoord.x, u_view.y * u_scale - gl_FragCoord.y) / u_scale;
  vec2 uv = (css - u_cam.xy) / u_cam.zw;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) { gl_FragColor = vec4(0.0); return; }
  float zoom = u_cam.z / u_view.x;      // 1 = whole map fills the width
  vec2 px = u_cam.zw;                   // map size in CSS px, to measure things on screen
  vec3 m = texture2D(u_mask, uv).rgb;
  float water = m.r, forest = m.g, depth = m.b;
  float t = u_t;

  vec3 P = vec3(0.0); // premultiplied light
  float A = 0.0;      // light coverage

  // --- sea: sparse sun glints, mostly inside slowly moving patches of sunlight
  float band = smoothstep(0.45, 0.85, fbm(uv * vec2(4.0, 3.0) + vec2(t * 0.015, -t * 0.01)));
  vec2 gq = uv * vec2(900.0, 560.0) + vec2(t * 0.6, -t * 0.35);
  float glint = pow(n(gq), 40.0) * 2.6;
  glint *= water * (0.12 + band) * (0.5 + 0.5 * sin(t * 2.4 + h(floor(gq)) * 6.28));
  P += vec3(1.0, 0.93, 0.8) * glint * 0.6; A += glint * 0.6;
  // long, slow swell highlights
  float swell = smoothstep(0.92, 1.0, sin(dot(uv, vec2(38.0, 61.0)) * 6.28 + fbm(uv * 6.0) * 6.0 - t * 0.6));
  P += vec3(0.75, 0.85, 0.95) * swell * water * 0.05 * (1.0 - depth * 0.5); A += swell * water * 0.05;

  // --- surf: lines rolling in towards every coast (depth: ~0.5 at the shore, 1 out at sea)
  float near = water * (1.0 - smoothstep(0.55, 0.9, depth)) * smoothstep(0.25, 0.5, depth);
  float surf = smoothstep(0.75, 1.0, sin(depth * 70.0 + t * 1.5 + fbm(uv * 30.0) * 3.0));
  float foam = near * surf * (0.55 + 0.45 * n(uv * 300.0 + t * 0.3));
  P += vec3(0.92, 0.95, 0.97) * foam * 0.32; A += foam * 0.32;

  // --- forest canopy: a faint ripple of light as the wind passes
  float rip = n(uv * vec2(520.0, 330.0) + vec2(t * 0.9, t * 0.35)) * n(uv * vec2(90.0, 60.0) + vec2(t * 0.25, 0.0));
  float leaf = forest * smoothstep(0.35, 0.7, rip) * 0.07;
  P += vec3(0.85, 0.95, 0.7) * leaf; A += leaf;

  // --- lit windows at each location: a few warm points that twinkle, sized for the zoom
  for (int i = 0; i < 10; i++) {
    for (int k = 0; k < 4; k++) {
      vec2 off = (vec2(h(vec2(float(i), float(k))), h(vec2(float(k) + 7.0, float(i) + 3.0))) - 0.5) * vec2(0.010, 0.012);
      vec2 d = (uv - u_lm[i] - off) * px;
      float r = 1.1 + 1.4 * zoom;
      float flick = 0.55 + 0.45 * sin(t * (2.0 + float(k)) + float(i * 7 + k) * 1.7) * n(vec2(t * 3.0, float(i * 4 + k)));
      float g = flick * (r * r) / (dot(d, d) + r * r) * 0.9;
      P += vec3(1.0, 0.78, 0.42) * g * 0.6; A += g * 0.6;
    }
  }

  // --- lighthouse: a sweeping beam over the water
  vec2 lv = (uv - u_light) * px;
  float ld = length(lv);
  float ang = atan(lv.y, lv.x) - t * 0.9;
  float beam = pow(max(0.0, cos(ang)), 60.0) * (1.0 - smoothstep(10.0 * zoom, 380.0 * zoom, ld)) * smoothstep(2.0, 2.0 + 10.0 * zoom, ld);
  float lamp = exp(-ld / (3.0 + 2.0 * zoom)) * (0.7 + 0.3 * sin(t * 5.0));
  P += vec3(1.0, 0.92, 0.72) * (beam * 0.35 + lamp * 0.9); A += beam * 0.35 + lamp * 0.9;

  // --- village chimney smoke: wisps rising and drifting with the wind
  vec2 sv = (uv - u_smoke) * px / (24.0 * zoom); // ~24 CSS px per unit at zoom 1
  float rise = clamp(-sv.y, 0.0, 4.0);
  float plume = (1.0 - smoothstep(0.0, 0.9 + rise * 0.35, abs(sv.x - rise * rise * 0.12 - sin(rise * 2.0 - t) * 0.12)))
              * smoothstep(0.0, 0.4, rise) * (1.0 - smoothstep(2.6, 4.0, rise));
  float smoke = plume * smoothstep(0.35, 0.8, fbm(sv * 1.6 + vec2(-t * 0.1, t * 0.8))) * 0.45;

  // --- cloud shadows over everything
  float cs = smoothstep(0.52, 0.78, fbm(uv * vec2(3.0, 1.9) + vec2(t * 0.012, t * 0.004)));
  float shade = cs * 0.2;

  A = clamp(A, 0.0, 1.0);
  P = min(P, vec3(A)); // keep it valid premultiplied
  // smoke (grey) and shadow (black) sit under the light
  vec3 col = P + vec3(0.72, 0.7, 0.68) * smoke * (1.0 - A);
  float a = A + smoke * (1.0 - A);
  a = a + shade * (1.0 - a);
  gl_FragColor = vec4(col, a);
}`;

/** Read the map once into a small mask: R = water, G = forest, B = blurred water (rough distance from the coast). */
function buildMask(img: HTMLImageElement): Uint8Array | null {
  const c = document.createElement("canvas");
  c.width = MASK_W;
  c.height = MASK_H;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, MASK_W, MASK_H);
  let src: ImageData;
  try {
    src = ctx.getImageData(0, 0, MASK_W, MASK_H);
  } catch {
    return null; // a cross-origin image can't be read; skip the effects
  }
  const N = MASK_W * MASK_H, d = src.data;
  const blue = new Uint8Array(N), water = new Float32Array(N), out = new Uint8Array(N * 4);
  for (let i = 0; i < N; i++) {
    const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
    const lum = 0.3 * r + 0.59 * g + 0.11 * b;
    blue[i] = b > r + 18 && b >= g - 4 ? 1 : 0; // bluish
    const f = !blue[i] && g > r + 2 && g >= b && lum < 95 ? 1 : 0; // dark green = forest
    out[i * 4 + 1] = f * 255;
    out[i * 4 + 3] = 255;
  }
  // The sea is the bluish area connected to the map's edges. Flood-filling from the border keeps
  // bluish-shaded hills and mountain shadows inland from being mistaken for water (which put surf
  // rings and glints on the land).
  const queue = new Int32Array(N);
  let qh = 0, qt = 0;
  const seed = (i: number) => {
    if (blue[i] && !water[i]) {
      water[i] = 1;
      queue[qt++] = i;
    }
  };
  for (let x = 0; x < MASK_W; x++) {
    seed(x);
    seed((MASK_H - 1) * MASK_W + x);
  }
  for (let y = 0; y < MASK_H; y++) {
    seed(y * MASK_W);
    seed(y * MASK_W + MASK_W - 1);
  }
  while (qh < qt) {
    const i = queue[qh++], x = i % MASK_W;
    if (x > 0) seed(i - 1);
    if (x < MASK_W - 1) seed(i + 1);
    if (i >= MASK_W) seed(i - MASK_W);
    if (i < N - MASK_W) seed(i + MASK_W);
  }
  for (let i = 0; i < N; i++) out[i * 4] = water[i] * 255;
  // separable box blur, three passes ≈ gaussian, radius 7 mask px
  const blur = (a: Float32Array) => {
    const tmp = new Float32Array(N), R = 7, k = 1 / (2 * R + 1);
    for (let y = 0; y < MASK_H; y++) {
      let s = 0;
      for (let x = -R; x <= R; x++) s += a[y * MASK_W + Math.min(MASK_W - 1, Math.max(0, x))];
      for (let x = 0; x < MASK_W; x++) {
        tmp[y * MASK_W + x] = s * k;
        s += a[y * MASK_W + Math.min(MASK_W - 1, x + R + 1)] - a[y * MASK_W + Math.max(0, x - R)];
      }
    }
    for (let x = 0; x < MASK_W; x++) {
      let s = 0;
      for (let y = -R; y <= R; y++) s += tmp[Math.min(MASK_H - 1, Math.max(0, y)) * MASK_W + x];
      for (let y = 0; y < MASK_H; y++) {
        a[y * MASK_W + x] = s * k;
        s += tmp[Math.min(MASK_H - 1, y + R + 1) * MASK_W + x] - tmp[Math.max(0, y - R) * MASK_W + x];
      }
    }
  };
  const deep = water.slice();
  blur(deep);
  blur(deep);
  blur(deep);
  for (let i = 0; i < N; i++) out[i * 4 + 2] = Math.round(deep[i] * 255);
  return out;
}

// ---------------------------------------------------------------- "Living kingdom" sprites
const RATIO = REALM_MAP.width / REALM_MAP.height;
/** Sea lanes for the ships, in map uv (open water around the island). */
const ROUTES: [number, number][][] = [
  [[0.05, 0.12], [0.25, 0.07], [0.45, 0.08], [0.8, 0.12]],
  [[0.985, 0.42], [0.965, 0.56], [0.9, 0.735]],
  [[0.3, 0.965], [0.45, 0.95], [0.6, 0.93], [0.72, 0.965]],
  [[0.03, 0.62], [0.06, 0.5], [0.12, 0.38]],
];
/** Pennant colours: the fest's banner palette. */
const PENNANTS = ["#8e2b3a", "#c4772d", "#c9a23a", "#3f7d4f", "#2f6f8f", "#3b4a9a", "#6c3f8f", "#8e2b3a", "#c4772d", "#3f7d4f"];

/** Point and heading at fraction p along a polyline in map uv. */
function along(pts: [number, number][], p: number) {
  const L: number[] = [];
  let tot = 0;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot((pts[i][0] - pts[i - 1][0]) * RATIO, pts[i][1] - pts[i - 1][1]);
    L.push(l);
    tot += l;
  }
  let d = p * tot;
  for (let i = 0; i < L.length; i++) {
    if (d <= L[i] || i === L.length - 1) {
      const f = Math.min(1, d / L[i]), a = pts[i], b = pts[i + 1];
      return { u: a[0] + (b[0] - a[0]) * f, v: a[1] + (b[1] - a[1]) * f, ang: Math.atan2(b[1] - a[1], (b[0] - a[0]) * RATIO) };
    }
    d -= L[i];
  }
  return { u: pts[0][0], v: pts[0][1], ang: 0 };
}
/** The golden path, measured once so the lanterns walk at an even pace. */
const PATH_LEN: number[] = [0];
for (let i = 1; i < PATHWAY.length; i++) PATH_LEN.push(PATH_LEN[i - 1] + Math.hypot((PATHWAY[i][0] - PATHWAY[i - 1][0]) * RATIO, PATHWAY[i][1] - PATHWAY[i - 1][1]));
function pathAt(f: number): [number, number] {
  const d = f * PATH_LEN[PATH_LEN.length - 1];
  let i = 1;
  while (i < PATH_LEN.length - 1 && PATH_LEN[i] < d) i++;
  const k = (d - PATH_LEN[i - 1]) / (PATH_LEN[i] - PATH_LEN[i - 1] || 1);
  return [PATHWAY[i - 1][0] + (PATHWAY[i][0] - PATHWAY[i - 1][0]) * k, PATHWAY[i - 1][1] + (PATHWAY[i][1] - PATHWAY[i - 1][1]) * k];
}

type Flock = { p: number; y0: number; slope: number };

/** Ships with wakes, a passing flock of birds with ground shadows, pennants on each location, and a lantern procession. */
function makeSprites(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  const ships = ROUTES.map((r, i) => ({ r, p: (i * 0.29) % 1, dir: i % 2 ? -1 : 1, speed: 0.003 + i * 0.0005 }));
  let flock: Flock | null = null, nextFlock = 3;
  let W = 0, H = 0, dpr = 1;

  const resize = (w: number, h: number) => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = w;
    H = h;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  };

  const draw = (t: number, dt: number) => {
    if (!ctx) return;
    const { tx, ty, ws, hs } = realmCamera;
    const at = (u: number, v: number): [number, number] => [tx + u * ws, ty + v * hs];
    const sz = Math.max(0.8, Math.min(3, ws / Math.max(1, W))); // grows as the camera zooms in
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // ships crossing the bays, leaving a wake; they turn back at the end of their lane
    for (const s of ships) {
      s.p += s.dir * s.speed * dt;
      if (s.p > 1) {
        s.p = 1;
        s.dir = -1;
      } else if (s.p < 0) {
        s.p = 0;
        s.dir = 1;
      }
      const a = along(s.r, s.p);
      const [x, y] = at(a.u, a.v);
      if (x < -40 || y < -40 || x > W + 40 || y > H + 40) continue;
      const ang = a.ang + (s.dir < 0 ? Math.PI : 0);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      ctx.strokeStyle = "rgb(230 240 245)";
      ctx.lineWidth = 0.8 * sz;
      for (let k = 1; k <= 3; k++) {
        ctx.globalAlpha = 0.22 / k;
        ctx.beginPath();
        ctx.moveTo(-5 * sz, 0);
        ctx.lineTo((-5 - k * 6) * sz, (2 + k * 2.2) * sz);
        ctx.moveTo(-5 * sz, 0);
        ctx.lineTo((-5 - k * 6) * sz, -(2 + k * 2.2) * sz);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#3b2616";
      ctx.beginPath();
      ctx.ellipse(0, 0, 5.5 * sz, 1.9 * sz, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.rotate(-ang); // sails stay upright on screen
      ctx.fillStyle = "#efe2c6";
      ctx.beginPath();
      ctx.moveTo(0, -1 * sz);
      ctx.lineTo(0, -9 * sz);
      ctx.lineTo(4.5 * sz, -2 * sz);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-0.6 * sz, -1.5 * sz);
      ctx.lineTo(-0.6 * sz, -7 * sz);
      ctx.lineTo(-3.6 * sz, -2 * sz);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // a pennant fluttering above each location, in the fest colours
    EVENTS.forEach((e, i) => {
      const l = LANDMARKS[e.landmark];
      const [x, y] = at(l.x, l.y - 0.006);
      const s = sz * 1.1;
      if (x < -30 || y < -40 || x > W + 30 || y > H + 30) return;
      ctx.strokeStyle = "#2a1d12";
      ctx.lineWidth = 0.9 * s;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - 13 * s);
      ctx.stroke();
      ctx.fillStyle = PENNANTS[i % PENNANTS.length];
      ctx.beginPath();
      ctx.moveTo(x, y - 13 * s);
      for (let j = 0; j <= 6; j++) {
        const f = j / 6;
        ctx.lineTo(x + f * 10 * s, y - 13 * s + Math.sin(t * 6 + f * 4 + i) * 1.3 * s * f + f * 1.5 * s);
      }
      for (let j = 6; j >= 0; j--) {
        const f = j / 6;
        ctx.lineTo(x + f * 10 * s, y - 13 * s + 4.5 * s * (1 - f * 0.6) + Math.sin(t * 6 + f * 4 + i) * 1.3 * s * f + f * 1.5 * s);
      }
      ctx.closePath();
      ctx.fill();
    });

    // the lantern procession: travellers walking the golden path towards the fest, only on the
    // stretch that has been drawn so far
    const drawn = realmCamera.path;
    if (drawn > 0.01) {
      const N = 16;
      for (let k = 0; k < N; k++) {
        const f = ((k / N + t * 0.006) % 1) * drawn;
        const [u, v] = pathAt(f);
        const [x, y] = at(u, v);
        if (x < -20 || y < -20 || x > W + 20 || y > H + 20) continue;
        const fl = 0.75 + 0.25 * Math.sin(t * 7 + k * 2.3);
        const r = 3 * sz;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.4);
        g.addColorStop(0, `rgb(255 214 140 / ${(0.75 * fl).toFixed(3)})`);
        g.addColorStop(1, "rgb(255 170 80 / 0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r * 2.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgb(255 240 205 / ${fl.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y, 0.9 * sz, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // a V of birds crossing now and then, with their shadows on the ground below
    nextFlock -= dt;
    if (!flock && nextFlock <= 0) flock = { p: 0, y0: 0.15 + Math.random() * 0.5, slope: 0.15 + Math.random() * 0.2 };
    if (flock) {
      flock.p += dt / 16;
      const fu = -0.1 + flock.p * 1.25, fv = flock.y0 + flock.p * flock.slope;
      for (let k = 0; k < 7; k++) {
        const side = k === 0 ? 0 : (k % 2 ? 1 : -1) * Math.ceil(k / 2);
        const [x, y] = at(fu - Math.abs(side) * 0.012, fv + side * 0.014);
        const flap = Math.sin(t * 9 + k) * 2.2 * sz, w = 5 * sz;
        const wing = (ox: number, oy: number, col: string) => {
          ctx.strokeStyle = col;
          ctx.lineWidth = 1.1 * sz;
          ctx.beginPath();
          ctx.moveTo(x + ox - w, y + oy - flap);
          ctx.quadraticCurveTo(x + ox - w / 2, y + oy - 2 * sz, x + ox, y + oy);
          ctx.quadraticCurveTo(x + ox + w / 2, y + oy - 2 * sz, x + ox + w, y + oy - flap);
          ctx.stroke();
        };
        wing(18 * sz, 26 * sz, "rgb(0 0 0 / 0.22)"); // shadow on the ground
        wing(0, 0, "#141a20");
      }
      if (flock.p >= 1) {
        flock = null;
        nextFlock = 8 + Math.random() * 8;
      }
    }
  };

  return { resize, draw };
}

/** Compile the WebGL effects pass; returns null if WebGL or the shader isn't available. */
function makeGL(canvas: HTMLCanvasElement, stage: HTMLElement, lite: boolean) {
  const gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false, powerPreference: "low-power" });
  if (!gl) return null;
  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  };
  const vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = (name: string) => gl.getUniformLocation(prog, name);
  const uView = U("u_view"), uScale = U("u_scale"), uCam = U("u_cam"), uT = U("u_t");
  gl.uniform2fv(U("u_lm"), new Float32Array(EVENTS.flatMap((e) => [LANDMARKS[e.landmark].gx, LANDMARKS[e.landmark].gy])));
  gl.uniform2f(U("u_light"), LANDMARKS.lighthouse.x, LANDMARKS.lighthouse.y);
  gl.uniform2f(U("u_smoke"), LANDMARKS.village.x - 0.004, LANDMARKS.village.y - 0.012);
  gl.uniform1i(U("u_mask"), 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  let ready = false, scale = 1, lastMaskTry = 0;
  const tryMask = () => {
    const img = stage.querySelector<HTMLImageElement>(".realm-world-img");
    if (!img || !img.complete || !img.naturalWidth) return;
    const data = buildMask(img);
    if (!data) return;
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, MASK_W, MASK_H, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    ready = true;
    canvas.classList.add("is-live");
  };

  return {
    resize(w: number, h: number) {
      // soft effects don't need full retina resolution; lower-power devices draw them at 3/4 size
      scale = lite ? 0.75 : Math.min(window.devicePixelRatio || 1, 1.25);
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      gl.viewport(0, 0, canvas.width, canvas.height);
    },
    draw(now: number, w: number, h: number) {
      if (!ready) {
        if (now - lastMaskTry > 500) {
          lastMaskTry = now;
          tryMask(); // the map image loads lazily; build the mask once it's there
        }
        if (!ready) return;
      }
      gl.uniform2f(uView, w, h);
      gl.uniform1f(uScale, scale);
      gl.uniform4f(uCam, realmCamera.tx, realmCamera.ty, realmCamera.ws, realmCamera.hs);
      gl.uniform1f(uT, now / 1000);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    dispose() {
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}

export default function MapLife() {
  const glRef = useRef<HTMLCanvasElement>(null);
  const spriteRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const glCanvas = glRef.current, spriteCanvas = spriteRef.current;
    const stage = glCanvas?.parentElement;
    const mode = detectMotionMode();
    // Off only when the visitor asked for reduced motion; lower-power devices get a lighter version.
    if (!glCanvas || !spriteCanvas || !stage || mode === "reduced") return;
    const fx = makeGL(glCanvas, stage, mode === "lite"); // may be null: the sprites still run without WebGL
    const sprites = makeSprites(spriteCanvas);
    spriteCanvas.classList.add("is-live");

    const html = document.documentElement;
    let raf = 0, visible = true, last = performance.now();
    const resize = () => {
      fx?.resize(stage.clientWidth, stage.clientHeight);
      sprites.resize(stage.clientWidth, stage.clientHeight);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(stage);
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(stage);

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const realm = html.dataset.realm;
      if (!visible || document.hidden || !realm || realm === "hero") return; // only while the map is showing
      fx?.draw(now, stage.clientWidth, stage.clientHeight);
      sprites.draw(now / 1000, dt);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      fx?.dispose();
    };
  }, []);

  return (
    <>
      <canvas ref={glRef} className="realm-life" aria-hidden="true" />
      <canvas ref={spriteRef} className="realm-life realm-life-sprites" aria-hidden="true" />
    </>
  );
}
