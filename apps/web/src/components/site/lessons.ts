import type { LessonStep } from "./lesson";

// Step times come from scripts/demo/lessons.mjs (steps.json for each lesson).
export const LESSONS: { id: string; title: string; intro: string; steps: LessonStep[] }[] = [
  {
    id: "connect",
    title: "Connect your first model",
    intro: "One key is all you need. It takes about a minute.",
    steps: [
      { t: 0, title: "Open Models and keys", body: "Click Connect a model, or the key button at the top right." },
      { t: 2.17, title: "Pick your AI company", body: "Anthropic, OpenAI, Google and more. This film uses a test server, so it picks Custom." },
      { t: 4.63, title: "Paste your key and check it", body: "MoonlightC makes a real test call and lists every model the key unlocks." },
      { t: 8.45, title: "Ask anything", body: "Type a message and press Enter." },
    ],
  },
  {
    id: "switch",
    title: "Switch models mid-chat",
    intro: "Start with one model and ask the next question with another.",
    steps: [
      { t: 0, title: "Open the model menu", body: "Click the model's name under the message box." },
      { t: 2.11, title: "Pick another model", body: "Every model your keys unlock is in the list." },
      { t: 2.84, title: "Keep talking", body: "The new model picks up the same conversation." },
    ],
  },
  {
    id: "projects",
    title: "Keep chats together with Projects",
    intro: "A project gives every chat inside it the same instructions and files.",
    steps: [
      { t: 0, title: "Open Projects", body: "In the left bar, click Projects, then New project." },
      { t: 2.15, title: "Name it and write its instructions", body: "Every chat in the project follows them. Click Save project." },
      { t: 7.06, title: "Start a chat inside it", body: "Click New chat in this project. Answers follow its instructions." },
    ],
  },
  {
    id: "code",
    title: "Build an app in Code",
    intro: "Describe an app and try it a few seconds later.",
    steps: [
      { t: 0, title: "Start a code project", body: "Click Code at the top, then New code project, and give it a name." },
      { t: 3.33, title: "Describe what you want", body: "The AI writes the files for you." },
      { t: 7.33, title: "Try it", body: "Open Preview: the app runs right there, ready to use." },
    ],
  },
  {
    id: "private",
    title: "Chat privately",
    intro: "Private chats are never saved anywhere.",
    steps: [
      { t: 0, title: "Switch to Private", body: "Click the mode button under the message box (it says General) and choose Private." },
      { t: 3.67, title: "Chat as usual", body: "Every model works the same way." },
      { t: 8.63, title: "Close it and it's gone", body: "Start a new chat: the private one doesn't appear in your history." },
    ],
  },
  {
    id: "memory",
    title: "Let it remember you",
    intro: "Memory is off until you turn it on, and you can see every fact.",
    steps: [
      { t: 0, title: "Turn memory on", body: "Settings, then Memory, then Let the AI remember things. Click Save changes." },
      { t: 4.09, title: "Add a fact", body: "Or let the AI save facts as you chat. Every model uses them." },
      { t: 5.69, title: "Delete anything", body: "Edit or delete any fact whenever you like." },
    ],
  },
  {
    id: "theme",
    title: "Make it yours",
    intro: "Themes, layouts and which sections you see.",
    steps: [
      { t: 0, title: "Open Appearance", body: "Settings, then Appearance." },
      { t: 2.43, title: "Try a theme", body: "Click one to preview it. Click Save changes to keep it." },
      { t: 6.54, title: "Or follow your device", body: "Moonlight switches between light and dark with your device." },
    ],
  },
];

