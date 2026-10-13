import type { Metadata } from "next";
import { DocPage } from "@/components/site/doc-page";

export const metadata: Metadata = { title: "Privacy · MoonlightC" };

export default function Privacy() {
  return (
    <DocPage title="Privacy" updated="October 13, 2026">
      <p>MoonlightC is free, open-source software. We don&apos;t sell AI and we don&apos;t sell data. This page explains exactly what happens to your information.</p>
      <h2>What stays on your device</h2>
      <ul>
        <li>Your API keys, chats, modes and settings are stored in your browser&apos;s local storage on your device.</li>
        <li>Chats in Private mode are never stored anywhere.</li>
        <li>Python you or the AI runs executes inside your browser.</li>
      </ul>
      <h2>What passes through our server</h2>
      <ul>
        <li>When you send a message, check a key, use web tools or voice typing, your browser sends the request and the key it needs to our server, which forwards it to the provider you chose (for example Anthropic, OpenAI or Google) and streams the answer back.</li>
        <li>We don&apos;t store or log your keys, your messages, your audio or the answers. Our hosting provider (Vercel) keeps standard request logs (time, path, status) for operating the service.</li>
      </ul>
      <h2>The providers you choose</h2>
      <p>Each AI or search provider you connect handles your requests under its own privacy policy. Read theirs before you connect them. Voice typing without an OpenAI or Groq key uses your browser&apos;s built-in speech service, which may send audio to the browser maker.</p>
      <h2>Accounts and analytics</h2>
      <p>MoonlightC doesn&apos;t have accounts or analytics yet. When they arrive, this page will be updated before they go live, and you&apos;ll be able to see, export and delete everything tied to your account.</p>
      <h2>Children</h2>
      <p>MoonlightC is not for children under 13.</p>
      <h2>Contact</h2>
      <p>Open an issue at github.com/robertpierson/moonlightc for privacy questions.</p>
    </DocPage>
  );
}
