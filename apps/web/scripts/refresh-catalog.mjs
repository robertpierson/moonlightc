// Re-reads download sizes for every model in src/data/model-catalog.json from the Ollama registry.
import fs from "node:fs";

const file = new URL("../src/data/model-catalog.json", import.meta.url);
const cat = JSON.parse(fs.readFileSync(file, "utf8"));
for (const m of cat.models) {
  const [name, tag] = m.tag.split(":");
  const res = await fetch(`https://registry.ollama.ai/v2/library/${name}/manifests/${tag}`, { headers: { accept: "application/vnd.docker.distribution.manifest.v2+json" } });
  if (!res.ok) {
    console.warn(`${m.tag}: not found (${res.status}); remove it from the catalog`);
    continue;
  }
  const manifest = await res.json();
  m.sizeGB = Math.round(manifest.layers.reduce((a, l) => a + l.size, 0) / 1e8) / 10;
  console.log(m.tag, m.sizeGB, "GB");
}
cat.checked = new Date().toISOString().slice(0, 10);
fs.writeFileSync(file, JSON.stringify(cat, null, 2) + "\n");
