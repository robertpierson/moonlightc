import { COMPANIES } from "./pages";

/** Questions people ask, by topic. The home page shows the first group; /questions shows all of them. */
export const QUESTIONS: { topic: string; items: [q: string, a: string][] }[] = [
  {
    topic: "The basics",
    items: [
      ["Is MoonlightC free?", "Yes. It's free and open source under the MIT license. You pay the AI companies directly for what you use, at their prices. We don't add a markup or limits."],
      [
        "What do I need to start?",
        "One API key from any AI company you like, pasted into Models and keys. A single OpenRouter key unlocks hundreds of models at once. Lesson 1 on the Learn page shows every click.",
      ],
      [
        "Can I use my Claude Pro or ChatGPT Plus subscription?",
        "Not directly: those companies don't let other apps use subscription sign-ins. Use an API key, or one OpenRouter key for hundreds of models. If you use Claude Code on your PC, MoonlightC can run it for you with your own sign-in.",
      ],
      ["Does it work on my phone?", "Yes. Open the web app in your phone's browser and add it to your home screen. It works like an app, with your chats synced when you sign in."],
      ["Can I change it?", "Yes. The code is on GitHub. Fork it, change it, run your own copy."],
    ],
  },
  {
    topic: "Keys and costs",
    items: [
      [
        "Where are my keys stored?",
        "On your device. If you sign in, they also sync to your account, stored encrypted. When you send a message, the key goes with that one request to the AI company and is never logged.",
      ],
      ["How much will I pay?", "Whatever the AI company charges for what you use, billed by them. MoonlightC adds nothing on top. Settings, then Usage, shows how much you've used."],
      ["Which companies work?", `${COMPANIES.join(", ")}. Also models running on your own PC, and any server that speaks the OpenAI API.`],
      ["What is Auto?", "Pick one model for coding, one for deep thinking and a fast one for quick questions. Auto sends each message to the right one. Set it up in Settings, then Auto model."],
    ],
  },
  {
    topic: "Privacy",
    items: [
      [
        "Do you read my chats?",
        "No. Your message passes through our server on its way to the AI company you picked, and we don't store or log it. Your chats live on your device, and in your account if you sign in.",
      ],
      ["What does Private mode do?", "A private chat is never saved anywhere, and it never reads or saves memories. Start a new chat and it's gone."],
      ["What does Memory remember?", "Only what you allow. Memory is off until you turn it on, and every fact it keeps is listed in Settings, then Memory, where you can edit or delete it."],
    ],
  },
  {
    topic: "The desktop app and remote control",
    items: [
      ["What does the desktop app add?", "Remote control of your PC from other devices, models that run on your own PC, and Claude Code with your own sign-in. Chat works the same everywhere."],
      [
        "Why does Windows or macOS warn me when I install it?",
        "The builds aren't code-signed yet, which costs money every year. On Windows click More info, then Run anyway. On a Mac open System Settings, then Privacy & Security, and click Open Anyway.",
      ],
      ["Which computers does it run on?", "Windows, Macs with Apple silicon or Intel, and Linux (x64 and ARM64, which includes Raspberry Pi and Chromebooks with Linux turned on)."],
      [
        "Is remote control safe?",
        "It only works on accounts with two-step sign-in, a new device can't connect until you allow it on the PC, the PC shows a banner while anyone is connected, and sessions end on their own.",
      ],
    ],
  },
  {
    topic: "The Chrome extension",
    items: [
      [
        "What can the extension see?",
        "Only tabs you share, one at a time. Shared tabs show a banner with a Stop button, Alt+Shift+M stops everything, sharing ends after 15 minutes without use, and buying, sending or deleting always waits for your OK.",
      ],
      ["Why isn't it in the Chrome Web Store?", "Not yet. For now you install it from a zip file. The Download page shows the four steps."],
    ],
  },
];

export function QuestionList({ items }: { items: [string, string][] }) {
  return (
    <div className="border-t border-[var(--line)]">
      {items.map(([q, a]) => (
        <details key={q} className="border-b border-[var(--line)]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-lg font-medium">
            {q}
            <span aria-hidden className="plus text-2xl leading-none font-light text-[var(--faint)]">
              +
            </span>
          </summary>
          <p className="pb-5 text-[var(--mist)]">{a}</p>
        </details>
      ))}
    </div>
  );
}
