# Website demo video

`public/demo/moonlightc-demo.mp4` is the real web app, filmed headlessly. The AI's answers come from `demo-ai.mjs`,
a stand-in server with written samples, so no AI company is paid. Re-film after big UI changes:

1. `pnpm build`, then start the app with private URLs allowed (PowerShell): `$env:MOONC_ALLOW_PRIVATE_URLS='1'; npx next start -p 3000`
2. `node scripts/demo/demo-ai.mjs` (port 4011)
3. `node scripts/demo/record.mjs <empty folder>` (prints the chapter times; copy them into `DEMO_CHAPTERS` in `src/components/site/pages.ts`)
4. In that folder:
   `ffmpeg -f concat -safe 0 -i frames.txt -vf "fps=30,scale=1920:1200:flags=lanczos,format=yuv420p" -c:v libx264 -preset slow -crf 21 -g 30 -movflags +faststart -an public/demo/moonlightc-demo.mp4`
   and a poster: `ffmpeg -ss 6.9 -i public/demo/moonlightc-demo.mp4 -frames:v 1 -q:v 3 public/demo/poster.jpg`
