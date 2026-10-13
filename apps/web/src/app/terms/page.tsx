import type { Metadata } from "next";
import { DocPage } from "@/components/site/doc-page";

export const metadata: Metadata = { title: "Terms · MoonlightC" };

export default function Terms() {
  return (
    <DocPage title="Terms" updated="October 13, 2026">
      <p>By using MoonlightC you agree to these terms.</p>
      <h2>The software</h2>
      <p>MoonlightC is open source under the MIT license and is provided as is, without warranty of any kind. You can use, copy, change and share it under that license.</p>
      <h2>Your keys and your providers</h2>
      <ul>
        <li>You bring your own API keys. You are responsible for what you do with them and for any charges your providers bill you.</li>
        <li>You must follow the terms of every AI, search and voice provider you connect.</li>
      </ul>
      <h2>Acceptable use</h2>
      <p>Don&apos;t use MoonlightC to break the law, to harm others, or to attack or overload our service or anyone else&apos;s.</p>
      <h2>Age</h2>
      <p>You must be at least 13 years old to use MoonlightC.</p>
      <h2>Changes</h2>
      <p>We may update these terms. The date at the top shows the latest version.</p>
    </DocPage>
  );
}
