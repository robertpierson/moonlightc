# Things only Shawn can do

Do them in order. When done, tell Claude "done, continue".

## 1. Free up a Supabase slot (needed for sign-in and saving chats)
Your free Supabase plan allows 2 active projects and both are in use ("Personal App Project" and "re-envision").
Creating MoonlightC's database would require a paid plan. Pick ONE option:

**Option A (free): pause a project you don't use right now**
1. Open https://supabase.com/dashboard/projects
2. Click the project you use least (for example **re-envision**).
3. Click **Project Settings** (gear icon, bottom left) > **General**.
4. Scroll to **Pause project**, click **Pause project**, then confirm.
   (Pausing keeps all data. You can press **Restore** later.)
5. Tell Claude: "paused, continue".

**Option B (paid, about $25/month + $10 per extra project): upgrade**
1. Open https://supabase.com/dashboard/org/umzghxzngixiedodscaa/billing
2. Click **Change subscription plan** > **Pro**, and confirm.
3. Tell Claude: "upgraded, continue".

---
## Try this yourself: Phase 0 (setup)
1. Open https://moonlightc.vercel.app on your PC and phone. You should see "MoonlightC" and one line about it.
2. Open https://github.com/robertpierson/moonlightc. That is the code. The green check next to the latest commit means all tests passed.

---
## Try this yourself: Phases 2 and 3 (preview, not live yet)
These go live at moonlightc.vercel.app once sign-in (step 1 above) is done. Until then, use the preview:
1. Open https://github.com/robertpierson/moonlightc/pull/1 and click the **Visit Preview** link in the Vercel comment (log in to Vercel if asked).
2. On the home page, scroll slowly: the moon's light moves. Click **Open web app**.
3. Click **Connect a model**. Pick **OpenRouter**, click **Get a key from OpenRouter**, make a key there, paste it, and click **Check key and connect**.
4. Ask anything. Press the square **Stop** button mid-answer: the partial answer stays.
5. Click **Compare** at the top, pick a second model, and send one question to both.
6. Open the preview on your phone and use the browser menu to **Install** / **Add to Home screen**.

---
## Optional: try the Studio and GitHub (preview link from PR #1)
1. Make a fal key: open https://fal.ai/dashboard/keys, sign in, click **Add key**, copy it. (fal charges per image/video from your own balance.)
2. In MoonlightC click the key icon (**Models and keys**), choose **fal (images, video, audio)**, paste, click **Check key and connect**.
3. Click **Studio**, describe an image, click **Generate**. Then the **Video** tab, describe a short clip, **Generate** (takes 1–5 minutes).
4. Click **Connections** > **Connect GitHub**. Make a token at https://github.com/settings/personal-access-tokens/new (Repository access: All repositories; Permissions: Contents, Issues, Pull requests = Read). Paste it and click **Connect**. Your real GitHub numbers appear.
5. In a chat, turn on nothing extra and ask: "What are my open pull requests?" Click **Allow once** when it asks.
