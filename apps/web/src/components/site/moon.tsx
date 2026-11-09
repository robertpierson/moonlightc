"use client";

import { useEffect, useRef } from "react";

// A huge silver moon rising behind the hero, drawn once with a fragment shader: thousands of craters at several sizes
// (bowls with raised rims), darker plains, and light from the upper left so every rim catches it. The canvas is the
// moon's box; the disc is wider than the screen and its top touches the top of the box. Drawn only on load and resize,
// so it costs nothing while you scroll (scrolling moves it with CSS).
const FRAG = `
precision highp float;
uniform vec3 disc; // center x, center y (pixels, from the bottom left), radius
uniform vec3 lit;
uniform vec3 dark;

vec3 hash3(vec3 p) {
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
  return fract(sin(p) * 43758.5453);
}
float hash1(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
float noise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash1(i), hash1(i + vec3(1,0,0)), f.x), mix(hash1(i + vec3(0,1,0)), hash1(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash1(i + vec3(0,0,1)), hash1(i + vec3(1,0,1)), f.x), mix(hash1(i + vec3(0,1,1)), hash1(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.07; a *= 0.5; } return v; }

// One layer of craters: each cell may hold a crater with its own size. Bowl below zero, sharp rim above.
float craters(vec3 p, float density) {
  vec3 i = floor(p), f = fract(p);
  float h = 0.0;
  for (int x = -1; x <= 1; x++)
  for (int y = -1; y <= 1; y++)
  for (int z = -1; z <= 1; z++) {
    vec3 g = vec3(float(x), float(y), float(z));
    vec3 r = hash3(i + g);
    if (r.z > density) continue; // not every cell has a crater
    float size = 0.12 + 0.4 * r.y * r.y; // mostly small, a few big
    float d = length(g + r - f) / size;
    if (d > 1.6) continue;
    float bowl = (d * d - 1.0) * 0.6;
    float k = (d - 1.0) * 5.5;
    float rim = exp(-k * k) * 0.35;
    h += d < 1.0 ? bowl + rim : rim * smoothstep(1.6, 1.0, d);
  }
  return h;
}

float height(vec3 n) {
  float plains = smoothstep(0.42, 0.58, fbm(n * 4.5 + 7.0)); // the dark seas, which are smooth
  float h = craters(n * 5.0, 0.6) * 0.6 + craters(n * 13.0, 0.5) * 0.3 + craters(n * 34.0, 0.4) * 0.15 + craters(n * 85.0, 0.3) * 0.07;
  h *= 1.0 - plains * 0.8;
  return h + fbm(n * 160.0) * 0.03;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - disc.xy) / disc.z; // 1.0 at the rim
  float d = length(uv);
  float edge = 1.5 / disc.z;
  if ((d - 1.0) * disc.z > 400.0) discard;
  vec3 col = vec3(0.0);
  float alpha = 0.0;
  if (d < 1.0) {
    vec3 n = normalize(vec3(uv, sqrt(max(0.0, 1.0 - d * d))));
    // Bump the surface with the crater heights (finite differences along the surface).
    float e = 0.0012;
    vec3 t1 = normalize(cross(n, vec3(0.0, 1.0, 0.0001)));
    vec3 t2 = cross(n, t1);
    float h0 = height(n);
    float hx = height(normalize(n + t1 * e));
    float hy = height(normalize(n + t2 * e));
    vec3 bump = normalize(n - (t1 * (hx - h0) + t2 * (hy - h0)) / e * 0.013);
    vec3 L = normalize(vec3(-0.55, 0.55, 0.62));
    float diff = max(dot(bump, L), 0.0);
    float plains = smoothstep(0.42, 0.58, fbm(n * 4.5 + 7.0));
    float grain = fbm(n * 220.0) - 0.5;
    float albedo = 0.95 - plains * 0.3 + (fbm(n * 24.0) - 0.5) * 0.12 + (fbm(n * 9.0 + 3.0) - 0.5) * 0.14 + grain * 0.07;
    vec3 silver = mix(vec3(0.78, 0.81, 0.88), vec3(0.98, 0.985, 1.0), 0.45 + 0.55 * n.z);
    col = mix(dark, lit * silver, albedo * (0.28 + 0.82 * diff));
    // A polished rim, and a little darkening toward the edge like the real moon.
    col *= 0.9 + 0.1 * n.z;
    col += vec3(0.9, 0.93, 1.0) * pow(1.0 - n.z, 4.0) * 0.35;
    alpha = smoothstep(1.0, 1.0 - edge, d);
  }
  // A soft white halo above the rim, measured in pixels so it looks the same on every screen.
  float glow = exp(-max(d - 1.0, 0.0) * disc.z / 70.0) * 0.6;
  col = mix(lit, col, alpha);
  alpha = alpha + glow * (1.0 - alpha);
  gl_FragColor = vec4(col, alpha);
}`;

const VERT = "attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }";

function hexToRGB(hex: string): [number, number, number] {
  const h = hex.slice(1);
  // Stylesheets get minified, so "#ffffff" can arrive as "#fff".
  const n = parseInt(h.length === 3 ? [...h].map((c) => c + c).join("") : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Room above the disc, in CSS pixels, for the halo to fade out before the top of the canvas. */
export const HALO = 160;

function setup(canvas: HTMLCanvasElement): () => void {
  const gl = canvas.getContext("webgl", { premultipliedAlpha: false, antialias: false, preserveDrawingBuffer: true });
  if (!gl) {
    canvas.dataset.fallback = "true";
    return () => {};
  }
  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    canvas.dataset.fallback = "true";
    return () => {};
  }
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  // No blending: each pixel is written once, as plain color plus coverage (blending here turned the halo grey).
  const u = (n: string) => gl.getUniformLocation(prog, n);
  const styles = getComputedStyle(canvas);
  gl.uniform3fv(u("lit"), hexToRGB(styles.getPropertyValue("--moon-lit").trim() || "#ffffff"));
  gl.uniform3fv(u("dark"), hexToRGB(styles.getPropertyValue("--moon-dark").trim() || "#8d97aa"));

  let raf = 0;
  let lastW = 0;
  const draw = () => {
    raf = 0;
    const dpr = Math.min(devicePixelRatio, 1.25);
    const w = Math.round(canvas.clientWidth * dpr);
    const h = Math.round(canvas.clientHeight * dpr);
    if (w === lastW && canvas.height === h) return; // nothing changed
    lastW = w;
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
    // Wider than the screen; the top of the disc touches the top of the canvas (less a little room for the glow).
    const r = Math.max(w * 0.85, h * 1.6);
    gl.uniform3f(u("disc"), w / 2, h - HALO * dpr - r, r);
    gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    // Paint it in strips, one per frame, so a slow graphics chip never freezes the page (or trips Windows' GPU watchdog).
    gl.enable(gl.SCISSOR_TEST);
    const strips = 10;
    const strip = (i: number) => {
      if (lastW !== w) return; // resized meanwhile: a fresh draw is on its way
      const y0 = Math.floor((h * i) / strips);
      gl.scissor(0, h - Math.floor((h * (i + 1)) / strips), w, Math.floor((h * (i + 1)) / strips) - y0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (i === 0) canvas.dataset.ready = "true";
      if (i + 1 < strips) requestAnimationFrame(() => strip(i + 1));
    };
    strip(0);
  };
  const schedule = () => (raf ||= requestAnimationFrame(draw));
  schedule();
  const ro = new ResizeObserver(schedule);
  ro.observe(canvas);
  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
  };
}

export function Moon({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    // Start once the page has loaded, so the moon never delays the text.
    const begin = () => {
      if (!cancelled && ref.current) cleanup = setup(ref.current);
    };
    if (document.readyState === "complete") begin();
    else addEventListener("load", begin, { once: true });
    return () => {
      cancelled = true;
      removeEventListener("load", begin);
      cleanup?.();
    };
  }, []);
  return <canvas ref={ref} aria-hidden className={`moon-canvas ${className ?? ""}`} />;
}
