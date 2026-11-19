# Plan: community round (2026-11-19)

Owner asked: publish everything; a library where people make their own themes, modes, commands, setups and mods
(not just pick from random ones online), user friendly; and a chat to connect with friends.

1. Publish desktop 0.6.70 (PC storage, themes). Verify every download link.
2. Community library (one new view, "Community"):
   - DB `creations` (kind theme/mode/command/setup/mod, payload JSON validated on install, size cap), installs and
     reports tables, RPCs. Anyone can browse; signed-in people publish. 3 reports hide an item until staff review.
   - Make: a guided maker per kind with a live preview (themes/setups use AppPreview). Share from what you already
     made (My themes, your modes, your commands, saved setups). Mods: bundle your own pieces, optional sandboxed code.
   - Browse: filter by kind, search, Popular/New, preview, Add (goes into your own lists), Report. "Yours": unshare.
3. Friends (one new view, "Friends"):
   - Find people by exact username only (no people directory). Requests, accept, remove, block.
   - DB `friendships` (writes only through RPCs), `direct_messages` (RLS: only the two people; only friends can
     send; 30/minute limit; realtime).
   - Chat UI like the AI chat; "Ask AI" in a friend chat answers with your own model and posts it labeled as AI.
4. Tests: SQL RLS checks, unit, e2e with mocked Supabase where needed, a11y. Docs + course lesson.
