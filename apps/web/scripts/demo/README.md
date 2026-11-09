# Website demo video

`public/demo/moonlightc-demo.mp4` is the real web app, filmed headlessly. The AI's answers come from `demo-ai.mjs`,
a stand-in server with written samples, so no AI company is paid. Re-film after big UI changes:

1. `pnpm build`, then start the app with private URLs allowed (PowerShell): `$env:MOONC_ALLOW_PRIVATE_URLS='1'; npx next start -p 3000`
2. `node scripts/demo/demo-ai.mjs` (port 4011)
3. `node scripts/demo/record.mjs <empty folder>` (writes chapters.json with the time of every step; update `DEMO_CHAPTERS` and the `DEMO_CAMERA` points in `src/components/site/pages.ts` to match, then check frames with the camera test)
4. In that folder:
   `ffmpeg -f concat -safe 0 -i frames.txt -vf "fps=30,scale=1920:1200:flags=lanczos,format=yuv420p" -c:v libx264 -preset slow -crf 21 -g 30 -movflags +faststart -an public/demo/moonlightc-demo.mp4`
   and a poster: `ffmpeg -ss 6.9 -i public/demo/moonlightc-demo.mp4 -frames:v 1 -q:v 3 public/demo/poster.jpg`

## Learn page lessons and website screenshots

`node scripts/demo/lessons.mjs <empty folder> [lesson,lesson]` (same two servers as above; set `BASE` if the app isn't on :3000)
films each lesson into its own folder (frames.txt + steps.json) and saves screenshots to `<folder>/shots`. For each lesson:
`ffmpeg -f concat -safe 0 -i frames.txt -vf "fps=30,scale=1280:800:flags=lanczos,format=yuv420p" -c:v libx264 -preset slow -crf 25 -g 30 -movflags +faststart -an public/learn/<lesson>.mp4`,
a poster with `ffmpeg -sseof -0.3 -i public/learn/<lesson>.mp4 -frames:v 1 -vf scale=1280:-1 -c:v libwebp -quality 78 public/learn/<lesson>.webp`,
and copy steps.json times into `src/components/site/lessons.ts`. Screenshots: convert to `public/shots/<name>.webp` the same way.
