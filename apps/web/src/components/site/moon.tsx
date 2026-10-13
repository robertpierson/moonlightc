"use client";

import { useEffect, useRef } from "react";

// A lit moon drawn with one fragment shader. The light swings around it as you scroll, so the phase changes from
// crescent to full. No libraries; stops drawing when off screen; static under prefers-reduced-motion.
const FRAG = `
precision mediump float;
uniform vec2 res;
uniform float phase;
uniform float time;
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
  vec2 uv = (gl_FragCoord.xy - 0.5 * res) / min(res.x, res.y);
  float r = 0.36;
  float d = length(uv);
  vec3 col = vec3(0.0);
  float alpha = 0.0;
  vec3 L = normalize(vec3(sin(phase), 0.18, cos(phase)));
  if (d < r) {
    vec3 n = normalize(vec3(uv, sqrt(r * r - d * d)));
    float c = time * 0.02;
    vec3 q = vec3(n.x * cos(c) - n.z * sin(c), n.y, n.x * sin(c) + n.z * cos(c));
    float maria = smoothstep(0.45, 0.7, fbm(q * 2.2));
    float craters = fbm(q * 9.0);
    float albedo = 0.82 - maria * 0.28 + (craters - 0.5) * 0.18;
    float diff = smoothstep(-0.04, 0.35, dot(n, L));
    col = mix(dark * (0.55 + 0.25 * albedo), lit * albedo, diff);
    alpha = smoothstep(r, r - 0.004, d);
  }
  float glow = exp(-max(d - r, 0.0) * 14.0) * 0.55 * (0.35 + 0.65 * max(L.z * 0.5 + 0.5, 0.0));
  col += lit * glow * (1.0 - alpha);
  alpha = max(alpha, glow);
  gl_FragColor = vec4(col, alpha);
}`;

const VERT = "attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }";

function hexToRGB(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function Moon({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const gl = canvas.getContext("webgl", { premultipliedAlpha: false, antialias: true });
    if (!gl) {
      canvas.dataset.fallback = "true";
      return;
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
    gl.uniform3fv(u("lit"), hexToRGB(styles.getPropertyValue("--moon-lit").trim() || "#e4e8f2"));
    gl.uniform3fv(u("dark"), hexToRGB(styles.getPropertyValue("--moon-dark").trim() || "#1b2550"));

    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let visible = true;
    const start = performance.now();

    const resize = () => {
      const dpr = Math.min(devicePixelRatio, 1.5);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(u("res"), canvas.width, canvas.height);
      if (still) draw();
    };
    const draw = () => {
      const progress = Math.min(1, scrollY / Math.max(1, innerHeight));
      gl.uniform1f(u("phase"), -1.1 + progress * 1.1);
      gl.uniform1f(u("time"), still ? 0 : (performance.now() - start) / 1000);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!still && visible) raf = requestAnimationFrame(draw);
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      cancelAnimationFrame(raf);
      if (visible) draw();
    });
    const onScroll = () => still && draw();
    resize();
    draw();
    io.observe(canvas);
    addEventListener("resize", resize);
    addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      removeEventListener("resize", resize);
      removeEventListener("scroll", onScroll);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className={`moon-canvas ${className ?? ""}`} />;
}
