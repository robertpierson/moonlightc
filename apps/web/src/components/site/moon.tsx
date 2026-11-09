"use client";

import { useEffect, useRef } from "react";

// A huge silver moon rising over the bottom half of the hero, drawn with one fragment shader. The canvas covers the
// hero; the disc is wider than the screen and its top edge sits at the middle. The light shifts a little as you scroll.
// No libraries; draws only when something changes (no animation loop), so it costs nothing while you read.
const FRAG = `
precision highp float;
uniform vec3 disc; // center x, center y (pixels, from the bottom left), radius
uniform float phase;
uniform vec3 lit;
uniform vec3 dark;

float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float noise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }

void main() {
  vec2 uv = (gl_FragCoord.xy - disc.xy) / disc.z; // 1.0 at the rim
  float d = length(uv);
  vec3 col = vec3(0.0);
  float alpha = 0.0;
  vec3 L = normalize(vec3(sin(phase), 0.55, cos(phase)));
  float edge = 1.5 / disc.z; // one and a half pixels of antialiasing
  if (d < 1.0) {
    vec3 n = normalize(vec3(uv, sqrt(1.0 - d * d)));
    float maria = smoothstep(0.42, 0.72, fbm(n * 2.6 + 3.1));
    float craters = fbm(n * 14.0);
    float fine = fbm(n * 48.0);
    float albedo = 0.96 - maria * 0.16 + (craters - 0.5) * 0.08 + (fine - 0.5) * 0.04;
    // Brushed silver: cool at the rim, near white at the top of the arc.
    vec3 silver = mix(vec3(0.80, 0.84, 0.91), vec3(0.99, 0.99, 1.0), clamp(n.z * 1.2, 0.0, 1.0));
    float diff = smoothstep(-0.1, 0.6, dot(n, L));
    col = mix(dark * (0.85 + 0.15 * albedo), lit * albedo * silver, diff);
    alpha = smoothstep(1.0, 1.0 - edge, d);
  }
  // A soft halo above the rim.
  float glow = exp(-max(d - 1.0, 0.0) * 9.0) * 0.6;
  col += lit * glow * (1.0 - alpha);
  alpha = max(alpha, glow);
  gl_FragColor = vec4(col, alpha);
}`;

const VERT = "attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }";

function hexToRGB(hex: string): [number, number, number] {
  const h = hex.slice(1);
  // Stylesheets get minified, so "#ffffff" can arrive as "#fff".
  const n = parseInt(h.length === 3 ? [...h].map((c) => c + c).join("") : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function setup(canvas: HTMLCanvasElement): () => void {
  const gl = canvas.getContext("webgl", { premultipliedAlpha: false, antialias: false });
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
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  const u = (n: string) => gl.getUniformLocation(prog, n);
  const styles = getComputedStyle(canvas);
  gl.uniform3fv(u("lit"), hexToRGB(styles.getPropertyValue("--moon-lit").trim() || "#ffffff"));
  gl.uniform3fv(u("dark"), hexToRGB(styles.getPropertyValue("--moon-dark").trim() || "#aab5c9"));
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let raf = 0;
  const draw = () => {
    raf = 0;
    const w = canvas.width;
    const h = canvas.height;
    // Wider than the screen, with its top at the middle of the canvas.
    const r = Math.max(w * 0.78, h * 0.7);
    gl.uniform3f(u("disc"), w / 2, h / 2 - r, r);
    const progress = reduced ? 0 : Math.min(1, scrollY / Math.max(1, innerHeight));
    gl.uniform1f(u("phase"), -0.35 + progress * 0.5);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const schedule = () => (raf ||= requestAnimationFrame(draw));
  const resize = () => {
    // A big canvas: cap the pixel ratio so phones and 4K screens stay smooth.
    const dpr = Math.min(devicePixelRatio, 1.5);
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    schedule();
  };
  const onScroll = () => scrollY < innerHeight * 1.2 && schedule();
  resize();
  canvas.dataset.ready = "true";
  addEventListener("resize", resize);
  if (!reduced) addEventListener("scroll", onScroll, { passive: true });
  return () => {
    cancelAnimationFrame(raf);
    removeEventListener("resize", resize);
    removeEventListener("scroll", onScroll);
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
