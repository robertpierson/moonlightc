// Unit Converter mod for MoonlightC. Runs in a sandbox; talks to the app only through `moonc`.
const UNITS = {
  length: { mm: 0.001, cm: 0.01, m: 1, km: 1000, in: 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.344 },
  weight: { mg: 1e-6, g: 0.001, kg: 1, oz: 0.028349523125, lb: 0.45359237, st: 6.35029318 },
  volume: { ml: 0.001, l: 1, tsp: 0.00492892159375, tbsp: 0.01478676478125, cup: 0.2365882365, floz: 0.0295735295625, gal: 3.785411784 },
  speed: { ms: 1, kmh: 1 / 3.6, mph: 0.44704, knot: 0.514444444 },
};
const TEMP = ["c", "f", "k"];

function convert(value, from, to) {
  from = String(from).toLowerCase();
  to = String(to).toLowerCase();
  if (TEMP.includes(from) && TEMP.includes(to)) {
    const c = from === "c" ? value : from === "f" ? ((value - 32) * 5) / 9 : value - 273.15;
    return to === "c" ? c : to === "f" ? (c * 9) / 5 + 32 : c + 273.15;
  }
  for (const table of Object.values(UNITS)) {
    if (from in table && to in table) return (value * table[from]) / table[to];
  }
  throw new Error(`Can't convert ${from} to ${to}.`);
}

const round = (n) => Math.round(n * 1e6) / 1e6;

moonc.registerTool("convert_units", ({ value, from, to }) => ({ value, from, to, result: round(convert(Number(value), from, to)) }));

// Panel (shown in Mods when the mod is on).
moonc.panel.innerHTML = `
  <label>Value <input id="v" type="number" value="1" style="width:6rem"></label>
  <input id="f" value="km" size="5" aria-label="From unit"> to <input id="t" value="mi" size="5" aria-label="To unit">
  <p id="out" style="font-size:1.4rem;margin:.75rem 0"></p>`;
const update = () => {
  try {
    out.textContent = `${round(convert(Number(v.value), f.value, t.value))} ${t.value}`;
  } catch (e) {
    out.textContent = e.message;
  }
};
for (const el of [v, f, t]) el.addEventListener("input", update);
update();
