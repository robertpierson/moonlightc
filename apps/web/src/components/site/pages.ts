/** The website's pages, in menu order. */
export const PAGES = [
  ["/", "Overview"],
  ["/models", "Models"],
  ["/remote", "Remote control"],
  ["/code", "Code"],
  ["/extension", "Chrome extension"],
  ["/download", "Download"],
] as const;

/** AI companies MoonlightC connects to with a key. */
export const COMPANIES = ["Anthropic", "OpenAI", "Google Gemini", "xAI", "Mistral", "DeepSeek", "Groq", "Together AI", "Perplexity", "Cohere", "OpenRouter", "Azure OpenAI", "AWS Bedrock"];

/** Everything else, in the header's "More" drop-down. */
export const MORE = [
  ["/learn", "Learn"],
  ["/questions", "Questions"],
  ["https://github.com/robertpierson/moonlightc/releases", "What's new"],
  ["https://github.com/robertpierson/moonlightc", "Source code"],
  ["https://github.com/robertpierson/moonlightc/issues/new", "Report a problem"],
  ["/privacy", "Privacy"],
  ["/terms", "Terms"],
] as const;

/** Where each part starts in public/demo/moonlightc-demo.mp4 (from scripts/demo/record.mjs's chapters.json). */
export const DEMO_CHAPTERS = [
  { t: 0, label: "Ask anything" },
  { t: 7.7, label: "Switch models mid-chat" },
  { t: 14.3, label: "Build an app in Code" },
  { t: 21.2, label: "Use it right away" },
];

/**
 * The film's camera: [seconds, zoom, focus x, focus y] (focus as a share of the frame, 0.5 = middle). Between points it
 * eases. Timed from the recorder's marks: typing, the answer, the model menu, the code box and the finished app.
 */
export const DEMO_CAMERA: [number, number, number, number][] = [
  [0, 1, 0.5, 0.5],
  [0.6, 1, 0.5, 0.5],
  [1.3, 1.6, 0.6, 0.88],
  [3.1, 1.6, 0.6, 0.88],
  [3.9, 1.18, 0.56, 0.45],
  [6.1, 1.18, 0.56, 0.55],
  [6.8, 1, 0.5, 0.5],
  [7.6, 1, 0.5, 0.5],
  [8.2, 1.65, 0.68, 0.8],
  [8.9, 1.65, 0.68, 0.8],
  [9.5, 1.55, 0.6, 0.9],
  [10.8, 1.55, 0.6, 0.9],
  [11.5, 1.15, 0.56, 0.5],
  [12.8, 1.15, 0.56, 0.55],
  [13.6, 1, 0.5, 0.5],
  [15.0, 1, 0.5, 0.5],
  [15.6, 1.4, 0.58, 0.5],
  [16.6, 1.4, 0.58, 0.5],
  [17.4, 1.65, 0.37, 0.92],
  [19.3, 1.65, 0.37, 0.92],
  [20.1, 1, 0.5, 0.5],
  [21.4, 1, 0.5, 0.5],
  [22.2, 1.6, 0.79, 0.55],
  [25.6, 1.6, 0.79, 0.55],
  [26.4, 1, 0.5, 0.5],
];
