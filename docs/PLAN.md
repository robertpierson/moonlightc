# Plan: website round "extensive, teach people, real pictures" (Nov 9, 2026)

Owner asked (Nov 9, 2026):
- Tiles should look like the Chrome extension page's screenshots: a real picture with the text under it.
- The site is too short. Make it extensive.
- Add a place to learn how to use the app, with interactive videos. It shouldn't be a main tab; put it in a "More" menu with other pages.

Steps:
1. "More" menu in the header (and in the phone menu), holding:
   - Learn
   - Questions (FAQ)
   - What's new (real GitHub releases)
   - Privacy
   - Terms
   - Source code
2. /learn: short lessons. Each has a real filmed clip of the app (filmed headlessly with the sample-answers server, as with the demo). The steps beside the clip jump the video when clicked and light up as it plays. Each lesson ends with a "Try it" button.
3. Real screenshots of the app's screens (scripts/demo/shots.mjs) for the tiles:
   - The tiles become figures: a picture card with a caption underneath.
   - No more text-in-a-box tiles.
4. Longer pages: more sections per page (how it works, details, questions), built from real features only.
5. Before going live, check every step with build, tests, the accessibility checks and screenshots. Then send the owner pictures and wait for their yes.
