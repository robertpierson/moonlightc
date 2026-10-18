// "Follow the sun": the app gets darker as the sun sets where you are, and lighter as it rises.

/** The sun's height above the horizon in degrees (negative below it), from a standard low-precision formula. */
export function sunElevation(lat: number, lon: number, date = new Date()) {
  const rad = Math.PI / 180;
  const d = date.getTime() / 86_400_000 - 10957.5; // days since 2000-01-01 12:00 UTC
  const g = (357.529 + 0.98560028 * d) * rad;
  const q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad;
  const e = (23.439 - 0.00000036 * d) * rad;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = (18.697374558 + 24.06570982441908 * d) % 24;
  const ha = (gmst * 15 + lon) * rad - ra;
  return Math.asin(Math.sin(lat * rad) * Math.sin(dec) + Math.cos(lat * rad) * Math.cos(dec) * Math.cos(ha)) / rad;
}

/** Light or dark, and how dim (1 = full brightness) for a sun height: dimming through dusk and dawn. */
export function sunLook(elevation: number): { mode: "light" | "dark"; brightness: number } {
  if (elevation < -4) return { mode: "dark", brightness: 1 };
  const t = Math.min(1, Math.max(0, (elevation + 4) / 14)); // -4° … 10°
  return { mode: "light", brightness: +(0.72 + 0.28 * t).toFixed(3) };
}

const KEY = "moonc:sun";
export const sunPlace = (): { lat: number; lon: number } | null => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "null");
  } catch {
    return null;
  }
};
export const setSunPlace = (p: { lat: number; lon: number } | null) => {
  try {
    if (p) localStorage.setItem(KEY, JSON.stringify({ lat: +p.lat.toFixed(1), lon: +p.lon.toFixed(1) }));
    else localStorage.removeItem(KEY);
  } catch {}
  dispatchEvent(new Event("moonc:sun"));
};
