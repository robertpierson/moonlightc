// Background effects drawn on a canvas behind the app. Light on the PC: about 30 frames a second, paused while the
// window is hidden, and a still frame when the system asks for reduced motion.
export const EFFECTS = [
  { id: "none", name: "None" },
  { id: "rain", name: "Rain" },
  { id: "snow", name: "Snow" },
  { id: "lanterns", name: "Lanterns" },
  { id: "fireflies", name: "Fireflies" },
  { id: "stars", name: "Stars" },
] as const;
export type EffectId = (typeof EFFECTS)[number]["id"];

type P = { x: number; y: number; vx: number; vy: number; r: number; a: number; t: number };

export function runEffect(canvas: HTMLCanvasElement, kind: EffectId, amount: number): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx || kind === "none") return () => {};
  let w = 0;
  let h = 0;
  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = innerWidth;
    h = innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  const base = { rain: 140, snow: 90, lanterns: 16, fireflies: 40, stars: 160 }[kind];
  const n = Math.max(1, Math.round(base * amount));
  const rnd = (a: number, b: number) => a + Math.random() * (b - a);
  const make = (fresh: boolean): P => {
    switch (kind) {
      case "rain":
        return { x: rnd(-50, w), y: fresh ? rnd(-h, h) : rnd(-60, -10), vx: 1.5, vy: rnd(14, 22), r: rnd(10, 22), a: rnd(0.15, 0.4), t: 0 };
      case "snow":
        return { x: rnd(0, w), y: fresh ? rnd(-h, h) : -10, vx: 0, vy: rnd(0.6, 1.8), r: rnd(1.2, 3.5), a: rnd(0.4, 0.9), t: rnd(0, 6) };
      case "lanterns":
        return { x: rnd(0, w), y: fresh ? rnd(0, h + 80) : h + rnd(40, 120), vx: 0, vy: -rnd(0.25, 0.7), r: rnd(9, 18), a: rnd(0.55, 0.9), t: rnd(0, 6) };
      case "fireflies":
        return { x: rnd(0, w), y: rnd(0, h), vx: rnd(-0.4, 0.4), vy: rnd(-0.4, 0.4), r: rnd(1.5, 3), a: 0, t: rnd(0, 6) };
      default:
        return { x: rnd(0, w), y: rnd(0, h), vx: 0, vy: 0, r: rnd(0.5, 1.6), a: rnd(0.3, 1), t: rnd(0, 6) };
    }
  };
  const ps = Array.from({ length: n }, () => make(true));

  const draw = (dt: number) => {
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      p.t += dt * 0.05;
      if (kind === "rain") {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        ctx.strokeStyle = `rgba(200,220,255,${p.a})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 1.5, p.y - p.r);
        ctx.stroke();
        if (p.y > h + 30) ps[i] = make(false);
      } else if (kind === "snow") {
        p.x += Math.sin(p.t) * 0.5 * dt;
        p.y += p.vy * dt;
        ctx.fillStyle = `rgba(255,255,255,${p.a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        if (p.y > h + 10) ps[i] = make(false);
      } else if (kind === "lanterns") {
        p.x += Math.sin(p.t * 0.6) * 0.3 * dt;
        p.y += p.vy * dt;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3);
        g.addColorStop(0, `rgba(255,190,90,${p.a})`);
        g.addColorStop(0.35, `rgba(255,120,40,${p.a * 0.45})`);
        g.addColorStop(1, "rgba(255,90,20,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(255,214,150,${p.a})`;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.r * 0.7, p.r, 0, 0, Math.PI * 2);
        ctx.fill();
        if (p.y < -60) ps[i] = make(false);
      } else if (kind === "fireflies") {
        p.vx += rnd(-0.05, 0.05);
        p.vy += rnd(-0.05, 0.05);
        p.vx = Math.max(-0.6, Math.min(0.6, p.vx));
        p.vy = Math.max(-0.6, Math.min(0.6, p.vy));
        p.x = (p.x + p.vx * dt + w) % w;
        p.y = (p.y + p.vy * dt + h) % h;
        const a = 0.5 + 0.5 * Math.sin(p.t * 1.5);
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5);
        g.addColorStop(0, `rgba(220,255,140,${a})`);
        g.addColorStop(1, "rgba(180,255,90,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const a = p.a * (0.6 + 0.4 * Math.sin(p.t * 2));
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let raf = 0;
  let last = 0;
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    if (document.hidden || now - last < 33) return;
    const dt = last ? Math.min(3, (now - last) / 16.7) : 1;
    last = now;
    draw(dt);
  };
  if (still) draw(0);
  else raf = requestAnimationFrame(frame);
  addEventListener("resize", resize);
  return () => {
    cancelAnimationFrame(raf);
    removeEventListener("resize", resize);
    ctx.clearRect(0, 0, w, h);
  };
}
