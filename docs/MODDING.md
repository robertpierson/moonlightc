# Making MoonlightC mods

A mod is a folder with a manifest (`moonlightc-mod.json`) and, if it needs code, one JavaScript file. A mod can add:

- **AI tools** the model can call in any chat (`tools`, needs the `tools` permission and a `script`)
- **A panel** with its own small UI in the Mods screen (`panel`, needs the `panel` permission and a `script`)
- **Slash commands**: `/name some text` expands into a prompt template (`commands`)
- **Modes** (personas): instructions + creativity (`personas`)
- **Themes**: color tokens (`themes`)

The complete working example is [`examples/mods/units`](../examples/mods/units) (also published in the
[moonlightc-mods](https://github.com/robertpierson/moonlightc-mods) registry). It uses every feature above.

## Manifest

```json
{
  "id": "units",
  "name": "Unit Converter",
  "version": "1.0.0",
  "description": "What it does, in one sentence.",
  "author": "Your name",
  "permissions": ["tools", "panel"],
  "script": "mod.js",
  "tools": [
    {
      "name": "convert_units",
      "description": "Tell the model when to use this tool.",
      "inputSchema": { "type": "object", "properties": { "value": { "type": "number" } }, "required": ["value"] }
    }
  ],
  "panel": { "title": "Unit converter" },
  "commands": [{ "name": "/tldr", "description": "Summarize text", "prompt": "Summarize:\n\n{{input}}" }],
  "personas": [{ "name": "Explain like I'm 5", "instructions": "Explain everything simply." }],
  "themes": [{ "name": "Aurora", "tokens": { "primary": "#2fbf9b" } }]
}
```

The schema lives in [`packages/mods-sdk`](../packages/mods-sdk/src/index.ts) (`validateManifest`). Theme tokens can set
`background`, `foreground`, `card`, `primary`, `primary-foreground`, `accent`, `border` and `sidebar` (hex colors).

## Script API

Your script runs inside a sandboxed iframe. It has one global, `moonc`:

```js
// Register a tool. Return any JSON-serializable value; throw to report an error to the model.
moonc.registerTool("convert_units", async ({ value, from, to }) => ({ result: value * 2 }));

// Your panel's root element (only visible if the manifest has a "panel").
moonc.panel.innerHTML = "<p>Hello</p>";
```

## Security model

- The sandbox has no same-origin access: a mod can't read MoonlightC's pages, storage, API keys, chats or settings.
- A tool only receives the input the model sends to it.
- The script is downloaded once at install time and pinned; updating means reinstalling (and reviewing) the new version.
- Before install, MoonlightC shows everything the mod adds and every permission it asks for.
- A mod can still reach the internet from its sandbox, so only install mods you trust, and declare `network` if yours does.

## Publishing

1. Fork [moonlightc-mods](https://github.com/robertpierson/moonlightc-mods).
2. Add `mods/<your-id>/moonlightc-mod.json` (and your script).
3. Add an entry to `index.json` with the raw GitHub URL of your manifest.
4. Open a pull request. Anyone can also install your mod directly from its manifest URL in **Mods > Install from a link**.
