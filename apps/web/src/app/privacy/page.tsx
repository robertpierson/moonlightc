import type { Metadata } from "next";
import { DocPage } from "@/components/site/doc-page";
import { accountsEnabled } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Privacy · MoonlightC" };

export default function Privacy() {
  return (
    <DocPage title="Privacy" updated="October 13, 2026">
      <p>MoonlightC is free, open-source software. We don&apos;t sell AI and we don&apos;t sell data. This page explains exactly what happens to your information.</p>
      <h2>What stays on your device</h2>
      <ul>
        <li>Your API keys, chats, modes and settings are stored in your browser&apos;s local storage on your device. If you sign in, they also sync to your account (see below).</li>
        <li>Chats in Private mode are never stored anywhere.</li>
        <li>Python you or the AI runs executes inside your browser.</li>
      </ul>
      <h2>What passes through our server</h2>
      <ul>
        <li>When you send a message, check a key, use web tools or voice typing, your browser sends the request and the key it needs to our server, which forwards it to the provider you chose (for example Anthropic, OpenAI or Google) and streams the answer back.</li>
        <li>Passing a request on, we don&apos;t store or log your keys, your messages, your audio or the answers. Our hosting provider (Vercel) keeps standard request logs (time, path, status) for operating the service.</li>
      </ul>
      <h2>The providers you choose</h2>
      <p>Each AI or search provider you connect handles your requests under its own privacy policy. Read theirs before you connect them. Voice typing without an OpenAI or Groq key uses your browser&apos;s built-in speech service, which may send audio to the browser maker.</p>
      <h2>Accounts and usage stats</h2>
      {accountsEnabled ? (
        <>
          <p>An account is optional. If you create one, we store your email or sign-in provider (Google, GitHub, Apple, Discord or Microsoft), your name, username and picture choice, your onboarding answers (what you use AI for, which tools you use, how you heard about us, an optional phone number, your starting layout), how you signed up and the campaign or site that sent you, and your country.</p>
          <p>Signed-in usage stats record which features you use, which AI providers you connected (names only), whether a message went to a cloud or local model, your country, device type, operating system and browser, and when you used the app. They never include your messages, prompts, files or keys. In the EU, EEA, UK and Switzerland we only count anything after you say yes. Download buttons are counted anonymously.</p>
          <p>
            When you&apos;re signed in, your chats (titles and messages), settings, projects and memory sync through our database (Supabase) so they show up on your other devices, and your API keys sync too, stored encrypted (Supabase Vault). Chats in Private mode, and big files or pictures you attach, stay on the device they came from.
          </p>
          <p>
            If you share a chat, a copy of its text is stored and anyone with the link can read it, until you stop sharing it (Settings &gt; Privacy &amp; data). If you use remote control, we store your computers&apos; names, app versions and when they were last online; the screen, files and commands go straight between your devices, or through a relay (Cloudflare) on networks that block direct connections, which doesn&apos;t keep them. If you add your own relay key, it&apos;s stored encrypted.
          </p>
          <p>In Settings &gt; Account you can download all your account data or delete your account, which removes everything tied to it.</p>
        </>
      ) : (
        <p>MoonlightC doesn&apos;t have accounts or usage stats yet. When they arrive, this page will be updated before they go live, and you&apos;ll be able to see, export and delete everything tied to your account.</p>
      )}
      <h2>Children</h2>
      <p>MoonlightC is not for children under 13.</p>
      <h2>Contact</h2>
      <p>Open an issue at github.com/robertpierson/moonlightc for privacy questions.</p>
    </DocPage>
  );
}
