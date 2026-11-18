import path from "node:path";
import type { NextConfig } from "next";

// The desktop app runs this same app as a local server, so its build is self-contained ("standalone").
const desktop = process.env.DESKTOP_BUILD === "1";

const nextConfig: NextConfig = {
  ...(desktop ? { output: "standalone", distDir: ".next-desktop", outputFileTracingRoot: path.join(__dirname, "../..") } : {}),
  cacheComponents: true,
  partialPrefetching: true,
  // The Code preview loads its runtime with CORS so the app's real error messages reach "Fix it" (not "Script error.").
  headers: async () => [{ source: "/preview-runtime.js", headers: [{ key: "Access-Control-Allow-Origin", value: "*" }] }],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
