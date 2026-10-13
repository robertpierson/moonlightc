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


## 2. Let MoonlightC connect to Google (Gmail, Calendar, Drive) — about 10 minutes
This makes the **Connect Google** button appear. Google is free for this.
1. Open https://console.cloud.google.com/projectcreate , Project name: **MoonlightC**, click **Create**. Wait, then make sure **MoonlightC** is selected at the top.
2. Open https://console.cloud.google.com/apis/library/gmail.googleapis.com and click **Enable**. Do the same for
   https://console.cloud.google.com/apis/library/calendar-json.googleapis.com and https://console.cloud.google.com/apis/library/drive.googleapis.com
3. Open https://console.cloud.google.com/auth/branding , click **Get started**. App name: **MoonlightC**, support email: your email, click **Next**.
   Audience: **External**, **Next**. Contact email: your email, **Next**, tick the agreement, **Create**.
4. Open https://console.cloud.google.com/auth/audience , under **Test users** click **Add users**, type your Gmail address, **Save**.
5. Open https://console.cloud.google.com/auth/clients , click **Create client**. Application type: **Web application**. Name: **MoonlightC web**.
   Under **Authorized redirect URIs** click **Add URI** and paste exactly: `https://moonlightc.vercel.app/api/oauth/google/callback`
   Click **Create**. A box shows **Client ID** and **Client secret** — keep it open.
6. Open https://vercel.com/app-project21/moonlightc/settings/environment-variables . Add three variables (click **Add Another** between them), all environments ticked:
   - Key `GOOGLE_CLIENT_ID`, value: the Client ID from step 5
   - Key `GOOGLE_CLIENT_SECRET`, value: the Client secret from step 5
   - Key `OAUTH_STATE_SECRET`, value: any long random text (for example, mash the keyboard for 40 characters)
   Click **Save**.
7. Tell Claude: "Google done". Claude redeploys and tests it.

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

---
## Optional: publish a test version of the desktop app
Installers for Windows, Mac and Linux are built and waiting in a **draft** (private) release. Nothing is public until you choose.
1. Open https://github.com/robertpierson/moonlightc/releases
2. Click **0.1.0** (marked Draft) and look at the files.
3. If you want people to download it now: click the pencil (**Edit**), tick **Set as a pre-release**, click **Publish release**.
   The download page on the website then shows the right button for each visitor automatically.
   (Builds aren't code-signed yet, so Windows/Mac show a warning the first time; the download page explains how to open it.)
