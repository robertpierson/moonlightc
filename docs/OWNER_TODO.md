# Things only Shawn can do

Do them in order. When done, tell Claude "done, continue".

## 1. Create the MoonlightC database (2 minutes) — you paused "Personal App Project", thanks!
Claude's Supabase tool can't create projects (it asks for a cost confirmation it can't give), so:
1. Open https://supabase.com/dashboard/new/umzghxzngixiedodscaa
2. Project name: **moonlightc**
3. Database password: click **Generate a password** (you don't need to keep it).
4. Region: **East US (Ohio)**.
5. Click **Create new project**, then tell Claude "created".

## 2. Let MoonlightC connect to Google (Gmail, Calendar, Drive, YouTube) — about 10 minutes
This makes the **Connect Google** button appear. Google is free for this.
1. Open https://console.cloud.google.com/projectcreate , Project name: **MoonlightC**, click **Create**. Wait, then make sure **MoonlightC** is selected at the top.
2. Open https://console.cloud.google.com/apis/library/gmail.googleapis.com and click **Enable**. Do the same for
   https://console.cloud.google.com/apis/library/calendar-json.googleapis.com , https://console.cloud.google.com/apis/library/drive.googleapis.com and https://console.cloud.google.com/apis/library/youtube.googleapis.com
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


## 3. Optional: Spotify, Slack and Discord (each about 5 minutes; do only the ones you want)
For each one, after step 3 add the two values in Vercel exactly like step 6 of section 2
(https://vercel.com/app-project21/moonlightc/settings/environment-variables), then tell Claude which you did.

**Spotify**
1. Open https://developer.spotify.com/dashboard , log in, click **Create app**.
2. App name **MoonlightC**, description **AI assistant**, Redirect URI: `https://moonlightc.vercel.app/api/oauth/spotify/callback` (click **Add**), tick **Web API**, agree, **Save**.
3. Click **Settings**: copy **Client ID** into `SPOTIFY_CLIENT_ID`; click **View client secret** and copy it into `SPOTIFY_CLIENT_SECRET`.

**Slack**
1. Open https://api.slack.com/apps , click **Create New App** > **From scratch**, name **MoonlightC**, pick your workspace, **Create App**.
2. Left menu **OAuth & Permissions** > **Redirect URLs** > **Add New Redirect URL**: `https://moonlightc.vercel.app/api/oauth/slack/callback`, **Add**, **Save URLs**.
   Under **User Token Scopes** add: channels:read, groups:read, channels:history, groups:history, search:read, chat:write, users:read.
3. Left menu **Basic Information**: copy **Client ID** into `SLACK_CLIENT_ID` and **Client Secret** (click Show) into `SLACK_CLIENT_SECRET`.

**Discord**
1. Open https://discord.com/developers/applications , click **New Application**, name **MoonlightC**, **Create**.
2. Left menu **OAuth2** > **Redirects** > **Add Redirect**: `https://moonlightc.vercel.app/api/oauth/discord/callback`, **Save Changes**.
3. On the same page copy **Client ID** into `DISCORD_CLIENT_ID`; click **Reset Secret**, copy it into `DISCORD_CLIENT_SECRET`.

---
## Try this yourself: Chat, Cowork and Code (desktop app updated to 0.3.0)
1. Top left, switch between **Chat**, **Cowork** and **Code**: each has its own sidebar.
2. In Chat, open **Projects**, make one, then use a chat's **⋯ > Move to project**. Click the arrow next to the project to see its chats.
3. Only your 15 latest chats show; click **All chats** to see the rest.
4. In Code, click the folder icon to make a folder, then **+** next to it for a new project. Try the **Permission mode** menu above the code assistant.
5. In Cowork (desktop app), click **Share a folder**, or turn on **Use this PC**, and ask it to do something with your files.
6. Settings > **Usage** shows tokens and cost per model; Settings > **Memory** holds what the AI remembers.

## Try this yourself: sign in with OpenRouter (easiest way to get every model)
1. Open https://moonlightc.vercel.app/app (or the desktop app, now 0.2.1).
2. Click **Sign in with OpenRouter** under "What can I help with?".
3. Sign in or sign up on OpenRouter and approve. (New OpenRouter accounts need a few dollars of credit for most models; some models are free.)
4. You land back in MoonlightC with hundreds of models in the model menu.

## Try this yourself: theme, profile and the updated desktop app
1. Open MoonlightC on your PC (it was updated to 0.2.0 and is already running).
2. Bottom left, click **Add your name**: type your name and pick a picture.
3. Settings > **General** > Color mode: try **Light** and **Dark** (dark is now dark blue with black buttons).
4. Settings > **Appearance** > Theme editor: change a color, type a name, click **Save as my theme**.

## Try this yourself: your requests from this morning (live now)
1. Open https://moonlightc.vercel.app : the site is now light with gradients and a pearl moon.
2. Click **Open web app**. At the top left, switch between **Chat** and **Code**.
3. Click **Settings** (bottom left). Look through Models & API keys, Connectors, Plugins & mods, Appearance.
4. Settings > **Auto model**: pick a model for Everyday and one for Coding. Back in Chat, choose **Auto** at the top of the model menu.
5. Click the mode button under the message box (it says **General**): 3 main modes, the rest under **More options**.
6. Settings > **Plugins & mods** > **Browse Anthropic's plugin directory**, click **View** on "commit-commands", then **Install plugin**.

## Try this yourself: Phase 0 (setup)
1. Open https://moonlightc.vercel.app on your PC and phone. You should see "MoonlightC" and one line about it.
2. Open https://github.com/robertpierson/moonlightc. That is the code. The green check next to the latest commit means all tests passed.

---
## Try this yourself (live now at https://moonlightc.vercel.app)
1. Open https://moonlightc.vercel.app on your PC and phone. Scroll slowly: the moon's light moves. Click **Open web app**.
2. Click **Connect a model**, pick **OpenRouter**, click **Get a key from OpenRouter**, make a key there (add a few dollars of credit), paste it, click **Check key and connect**.
3. Ask anything. Press the square **Stop** button mid-answer: the partial answer stays. Try **Compare** at the top with two models.
4. On your phone, use the browser menu > **Add to Home screen** / **Install**. It opens like an app.
5. Try **Customize** > **Forge** or **Moon** (the whole look changes), and **Mods** > install **Unit Converter**, then ask "convert 10 km to miles".
6. Everything is saved in that browser only until sign-in exists (step 1 above).
---
## Optional: try the Studio and GitHub
1. Make a fal key: open https://fal.ai/dashboard/keys, sign in, click **Add key**, copy it. (fal charges per image/video from your own balance.)
2. In MoonlightC click the key icon (**Models and keys**), choose **fal (images, video, audio)**, paste, click **Check key and connect**.
3. Click **Studio**, describe an image, click **Generate**. Then the **Video** tab, describe a short clip, **Generate** (takes 1–5 minutes).
4. Click **Connections** > **Connect GitHub**. Make a token at https://github.com/settings/personal-access-tokens/new (Repository access: All repositories; Permissions: Contents, Issues, Pull requests = Read). Paste it and click **Connect**. Your real GitHub numbers appear.
5. In a chat, turn on nothing extra and ask: "What are my open pull requests?" Click **Allow once** when it asks.

---
## Optional: let the desktop app update itself
Today Claude installs new desktop versions on your PC by hand. For automatic updates (on any PC), the app needs public releases on GitHub.
That's publishing something publicly, so it needs your OK: tell Claude "publish desktop releases".

## Optional: put the Chrome extension in the Chrome Web Store (costs a one-time $5 Google fee; your call)
Right now people install it from the download page with "Load unpacked". Publishing makes it a one-click install.
Only do this if you want to pay the fee; tell Claude "publish the extension" and it will prepare the store listing and tell you what to click.

## Optional: publish a test version of the desktop app
Installers for Windows, Mac and Linux are built and waiting in a **draft** (private) release. Nothing is public until you choose.
1. Open https://github.com/robertpierson/moonlightc/releases
2. Click **0.1.0** (marked Draft) and look at the files.
3. If you want people to download it now: click the pencil (**Edit**), tick **Set as a pre-release**, click **Publish release**.
   The download page on the website then shows the right button for each visitor automatically.
   (Builds aren't code-signed yet, so Windows/Mac show a warning the first time; the download page explains how to open it.)
