# Chrome Web Store listing (copy and paste these)

Upload: the zip from `pnpm --filter @moonc/extension zip` (apps/web/public/downloads/moonlightc-chrome-extension.zip).

**Name:** MoonlightC

**Summary (132 characters max):**
Let the AI in MoonlightC read and use the browser tabs you share with it. Nothing is shared until you choose a tab.

**Category:** Productivity. **Language:** English.

**Description:**
MoonlightC puts every AI in one app, with your own keys. This extension lets the AI in MoonlightC work in your browser:

- Share a tab with one click. The AI can read it, click, type and open links there.
- Nothing else is visible to it. Tabs you don't share stay private.
- Buying, sending, posting, deleting and submitting forms always wait for you to click Allow, in a window the web page can't draw over.
- A banner on every shared tab shows it's shared, with a Stop button. Alt+Shift+M stops sharing everything.
- Sharing ends by itself after 15 minutes without use.
- The popup shows a log of everything the AI did.

Works with the MoonlightC web app at moonlightc.vercel.app. Free and open source: github.com/robertpierson/moonlightc

**Images:** store/1-shared-tab.png, store/2-popup.png, store/3-confirm.png (1280x800); small promo tile store/promo-440x280.png; icon icons/128.png.

**Privacy policy URL:** https://moonlightc.vercel.app/privacy

## Privacy practices tab

**Single purpose:** Let the AI in the MoonlightC web app read and act in browser tabs the user explicitly shares.

**Permission justifications:**
- tabs: find the tab the user shared and show its title and address to MoonlightC.
- scripting: read the shared tab's text and perform the click or typing the user's AI asked for, only in tabs the user shared.
- storage: remember which tabs are shared (until the browser closes) and keep the activity log on this device.
- Host permission (all sites): the user can share a tab on any website, so the extension must be able to run on whichever site they pick. It does nothing on a tab until the user shares it.

**Remote code:** No. All code is in the package.

**Data usage:** Website content (only from tabs the user shares) is sent to the MoonlightC web app open in the same browser, which passes it to the AI company the user chose, to answer the user's request. Not sold, not used for anything else, not used for creditworthiness or lending. Tick: "Website content". Certify the three disclosures.
