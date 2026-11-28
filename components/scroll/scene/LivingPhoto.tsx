"use client";

import { useEffect, useRef } from "react";
import { detectMotionMode } from "../SmoothScroll";

/**
 * Brings the hero photograph to life, in photo coordinates (it sits inside .photo-frame, so it
 * follows every crop, the slow camera push and the mouse parallax):
 *
 *  - Wind in the trees: a WebGL pass redraws the photo with a gentle sway and a fast rustle
 *    applied only to foliage (picked by colour inside hand-placed tree zones; the castle, rock
 *    and mountains never move).
 *  - Rolling mist: the valley fog slowly churns and drifts, with soft light moving through it;
 *    the sky clouds drift a little too.
 *  - Falling leaves: amber leaves come off the orange pine, tumble and flip, and drift out over
 *    the valley.
 *
 * One shared wind drives all three, so a gust moves the trees, the leaves and the mist together.
 * Off for reduced motion (the plain photo shows), lighter on low-power devices, paused when the hero
 * is off screen, the tab is hidden or the castle transition is running. If WebGL isn't available
 * the leaves still fall over the plain photo.
 */

/** Wind strength 0.25–1: long, uneven gusts. */
const gust = (t: number) => 0.25 + 0.75 * Math.pow(0.5 + 0.5 * Math.sin(t * 0.42) * Math.sin(t * 0.17 + 1.1), 2);

const VERT = `
attribute vec2 p;
varying vec2 v_uv;
void main() { v_uv = vec2(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5); gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `
precision mediump float;
uniform sampler2D u_tex;
uniform float u_t;
uniform float u_g;
varying vec2 v_uv;

float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { s += a * n(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return s;
}
// soft-edged rectangle (x0, y0, x1, y1) in photo uv
float box(vec2 uv, vec4 r, float e) {
  return smoothstep(r.x - e, r.x + e, uv.x) * (1.0 - smoothstep(r.z - e, r.z + e, uv.x))
       * smoothstep(r.y - e, r.y + e, uv.y) * (1.0 - smoothstep(r.w - e, r.w + e, uv.y));
}

void main() {
  vec2 uv = v_uv;
  vec3 c0 = texture2D(u_tex, uv).rgb;
  float mx = max(c0.r, max(c0.g, c0.b)), mn = min(c0.r, min(c0.g, c0.b));
  float lum = dot(c0, vec3(0.299, 0.587, 0.114));
  float sat = (mx - mn) / (mx + 0.001);
  float castle = box(uv, vec4(0.43, 0.05, 0.66, 0.62), 0.015);

  // Foliage: the left slope and orange pine, the foreground pines, the right-hand forest and the
  // tall pine beside the keep; picked by colour (saturated, not bright) plus the pale flowering
  // bushes along the bottom corners.
  float zone = max(max(box(uv, vec4(0.0, 0.36, 0.34, 1.0), 0.03), box(uv, vec4(0.33, 0.62, 0.56, 1.0), 0.03)),
                   max(box(uv, vec4(0.74, 0.48, 1.0, 1.0), 0.03), box(uv, vec4(0.395, 0.23, 0.44, 0.42), 0.012)));
  float leafy = smoothstep(0.16, 0.36, sat) * (1.0 - smoothstep(0.62, 0.86, lum));
  float bush = max(box(uv, vec4(0.0, 0.78, 0.3, 1.0), 0.03), box(uv, vec4(0.8, 0.8, 1.0, 1.0), 0.03));
  float fol = clamp(zone * max(leafy, bush * 0.8), 0.0, 1.0) * (1.0 - castle);

  // Mist: bright, low-saturation areas below the sky; sky clouds: the bright band along the top.
  float fog = smoothstep(0.5, 0.72, lum) * (1.0 - smoothstep(0.16, 0.32, sat)) * smoothstep(0.16, 0.24, uv.y) * (1.0 - castle);
  float sky = (1.0 - smoothstep(0.07, 0.12, uv.y)) * smoothstep(0.35, 0.6, lum);

  float t = u_t, g = u_g;
  // wind in the trees: a slow sway plus a fast rustle, both swelling with the gusts
  vec2 dF = vec2(sin(t * 1.3 + uv.y * 14.0 + uv.x * 6.0) * 0.0011 + (n(uv * vec2(70.0, 45.0) + vec2(t * 2.2, t * 0.7)) - 0.5) * 0.0024,
                 (n(uv * vec2(60.0, 40.0) + vec2(-t * 1.7, t * 1.1)) - 0.5) * 0.0012) * (0.45 + g);
  // the mist rolls slowly, drifting with the wind
  vec2 q = uv * vec2(5.0, 8.0);
  vec2 dM = (vec2(fbm(q + vec2(t * 0.05, t * 0.01)), fbm(q + vec2(4.3 - t * 0.02, 1.7 + t * 0.04))) - 0.5) * (0.011 + 0.004 * g);
  vec2 dS = vec2((fbm(uv * vec2(6.0, 30.0) + vec2(t * 0.03, 0.0)) - 0.5) * 0.012, 0.0);

  vec3 c = texture2D(u_tex, uv + dF * fol + dM * fog + dS * sky).rgb;
  // light moving through the mist
  c += fog * (fbm(uv * vec2(3.0, 6.0) + vec2(-t * 0.025, t * 0.008)) - 0.45) * 0.07;
  gl_FragColor = vec4(c, 1.0);
}`;

type Leaf = { x: number; y: number; vx: number; vy: number; rot: number; spin: number; flip: number; flipRate: number; sway: number; phase: number; size: number; color: string; age: number; life: number };
const LEAF_COLORS = ["#c8641e", "#e08a2c", "#b8451f", "#f0b44a", "#9a4e1c", "#d9772a"];
/** Where leaves come from, in photo uv: [x0, y0, x1, y1, share]. Mostly the orange pine. */
const SOURCES: [number, number, number, number, number][] = [
  [0.04, 0.4, 0.15, 0.66, 0.7], // the orange pine
  [0.19, 0.6, 0.24, 0.72, 0.18], // the small amber tree below it
  [0.0, 0.72, 0.12, 0.86, 0.12], // bushes on the slope
];

export default function LivingPhoto() {
  const glRef = useRef<HTMLCanvasElement>(null);
  const leafRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const glCanvas = glRef.current, leafCanvas = leafRef.current;
    const frame = glCanvas?.parentElement;
    if (!glCanvas || !leafCanvas || !frame) return;
    const mode = detectMotionMode();
    if (mode === "reduced") return; // the visitor asked for less motion: plain photo
    const lite = mode === "lite"; // lower-power device: a lighter version (smaller canvas, fewer leaves)

    const html = document.documentElement;
    const ctx2d = leafCanvas.getContext("2d");
    let W = 0, H = 0, dpr = 1, texW = 2048;
    let visible = true, raf = 0, last = performance.now(), spawnAcc = 0;
    const leaves: Leaf[] = [];
    const mobile = window.matchMedia("(max-width: 1023px)").matches;
    const maxLeaves = mobile || lite ? 7 : 14;

    // ---------- WebGL: the photo, redrawn with wind and mist ----------
    const gl = glCanvas.getContext("webgl", { alpha: false, antialias: false, premultipliedAlpha: false, powerPreference: "low-power" });
    let uT: WebGLUniformLocation | null = null, uG: WebGLUniformLocation | null = null, glReady = false;
    if (gl) {
      const sh = (type: number, src: string) => {
        const s = gl.createShader(type)!;
        gl.shaderSource(s, src);
        gl.compileShader(s);
        return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
      };
      const vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
      const prog = gl.createProgram()!;
      if (vs && fs) {
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
      }
      if (vs && fs && gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        gl.useProgram(prog);
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(prog, "p");
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        uT = gl.getUniformLocation(prog, "u_t");
        uG = gl.getUniformLocation(prog, "u_g");
        // Use the exact image the page already loaded (same URL, so it comes from the cache).
        const photo = frame.querySelector("img");
        const load = () => {
          const src = photo?.currentSrc || photo?.src;
          if (!src) return;
          const img = new Image();
          img.decoding = "async";
          img.onload = () => {
            texW = img.naturalWidth;
            const tex = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
            glReady = true;
            resize();
            draw(performance.now() / 1000);
            glCanvas.classList.add("is-live"); // fade in over the identical still photo
          };
          img.src = src;
        };
        if (photo?.complete && photo.naturalWidth) load();
        else photo?.addEventListener("load", load, { once: true });
      }
    }

    const resize = () => {
      W = frame.offsetWidth;
      H = frame.offsetHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      leafCanvas.width = Math.round(W * dpr);
      leafCanvas.height = Math.round(H * dpr);
      // never draw the photo at more pixels than the photo has
      const s = Math.min(lite ? 0.75 : dpr, texW / Math.max(1, W));
      glCanvas.width = Math.round(W * s);
      glCanvas.height = Math.round(H * s);
      if (gl) gl.viewport(0, 0, glCanvas.width, glCanvas.height);
    };

    const draw = (t: number) => {
      if (!gl || !glReady) return;
      gl.uniform1f(uT, t);
      gl.uniform1f(uG, gust(t));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    // ---------- Falling leaves ----------
    const spawn = () => {
      let r = Math.random(), src = SOURCES[0];
      for (const s of SOURCES) {
        if ((r -= s[4]) <= 0) { src = s; break; }
      }
      const k = W / 1920;
      leaves.push({
        x: (src[0] + Math.random() * (src[2] - src[0])) * W,
        y: (src[1] + Math.random() * (src[3] - src[1])) * H,
        vx: (8 + Math.random() * 14) * k,
        vy: (20 + Math.random() * 18) * k,
        rot: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 3,
        flip: Math.random() * Math.PI * 2,
        flipRate: 1.5 + Math.random() * 2.5,
        sway: (14 + Math.random() * 22) * k,
        phase: Math.random() * Math.PI * 2,
        size: (5 + Math.random() * 5) * Math.max(0.75, k),
        color: LEAF_COLORS[(Math.random() * LEAF_COLORS.length) | 0],
        age: 0,
        life: 11 + Math.random() * 7,
      });
    };

    const drawLeaves = (dt: number, t: number) => {
      if (!ctx2d) return;
      const g = gust(t);
      spawnAcc += dt * (0.35 + 1.1 * g) * (mobile ? 0.5 : 1);
      while (spawnAcc > 1) {
        spawnAcc -= 1;
        if (leaves.length < maxLeaves) spawn();
      }
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx2d.clearRect(0, 0, W, H);
      for (let i = leaves.length - 1; i >= 0; i--) {
        const L = leaves[i];
        L.age += dt;
        const k = W / 1920;
        L.x += (L.vx + g * 60 * k) * dt + Math.cos(L.age * 1.4 + L.phase) * L.sway * dt;
        L.y += L.vy * dt * (0.8 + 0.4 * Math.sin(L.age * 2.1 + L.phase));
        L.rot += L.spin * dt * (0.6 + g);
        L.flip += L.flipRate * dt;
        const fade = Math.min(1, L.age / 0.8, (L.life - L.age) / 1.5);
        if (fade <= 0 || L.y > H * 1.02 || L.x > W * 0.92) {
          leaves.splice(i, 1);
          continue;
        }
        ctx2d.save();
        ctx2d.globalAlpha = 0.9 * fade;
        ctx2d.translate(L.x, L.y);
        ctx2d.rotate(L.rot);
        ctx2d.scale(Math.max(0.12, Math.abs(Math.cos(L.flip))), 1); // tumbling: the leaf turns edge-on and back
        const s = L.size;
        ctx2d.fillStyle = L.color;
        ctx2d.beginPath();
        ctx2d.moveTo(0, -s);
        ctx2d.quadraticCurveTo(s * 0.75, -s * 0.2, 0, s);
        ctx2d.quadraticCurveTo(-s * 0.75, -s * 0.2, 0, -s);
        ctx2d.fill();
        ctx2d.strokeStyle = "rgb(60 25 8 / 0.55)"; // midrib
        ctx2d.lineWidth = Math.max(0.5, s * 0.08);
        ctx2d.beginPath();
        ctx2d.moveTo(0, -s * 0.85);
        ctx2d.lineTo(0, s * 1.25);
        ctx2d.stroke();
        ctx2d.restore();
      }
    };

    // ---------- Loop ----------
    const frameLoop = (now: number) => {
      raf = requestAnimationFrame(frameLoop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      // paused off screen, in a hidden tab, and while the castle transition runs (the hero is then
      // flattened into one scaled layer, and redrawing it every frame would be wasted work)
      if (!visible || document.hidden || html.dataset.realm) return;
      const t = now / 1000;
      draw(t);
      drawLeaves(dt, t);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(frame);
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(frame);
    raf = requestAnimationFrame(frameLoop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  return (
    <>
      <canvas ref={glRef} className="living-photo" aria-hidden="true" />
      <canvas ref={leafRef} className="living-leaves" aria-hidden="true" />
    </>
  );
}
