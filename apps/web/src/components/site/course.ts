// The free MoonlightC course: short lessons, each with steps you follow in the real app and one question to check
// yourself. Every button named here exists in the app; keep this in step with the UI when it changes.

export interface Lesson {
  slug: string;
  title: string;
  minutes: number;
  /** What you can do after it, in one line. */
  goal: string;
  steps: { title: string; body: string; code?: string }[];
  tip?: string;
  check: { q: string; options: string[]; answer: number; why: string };
  /** A button at the end that opens the right place. */
  go?: { label: string; href: string };
  /** A filmed lesson on /learn that shows the same thing. */
  film?: string;
}

export interface Module {
  id: string;
  title: string;
  summary: string;
  lessons: Lesson[];
}

export const COURSE: Module[] = [
  {
    id: "start",
    title: "Get started",
    summary: "What MoonlightC is, your first key, and your first chat.",
    lessons: [
      {
        slug: "what-it-is",
        title: "What MoonlightC is",
        minutes: 2,
        goal: "Know what you're paying for (nothing) and where your keys live (with you).",
        steps: [
          { title: "One window, every AI", body: "Claude, GPT, Gemini, Grok, Mistral, DeepSeek and hundreds more, in one app. You can switch between them in the middle of a conversation." },
          { title: "Your own keys", body: "An API key is a password an AI company gives you so apps can use their models. You pay the company directly, at their prices. MoonlightC adds no markup and sells no AI." },
          { title: "Three ways to use it", body: "The web app works in any browser. The desktop app adds your own PC: local models, Claude Code and remote control. The Chrome extension lets the AI use tabs you share." },
        ],
        check: {
          q: "Who do you pay when you use a model in MoonlightC?",
          options: ["MoonlightC, with a markup", "The AI company, directly, with your own key", "Nobody, ever"],
          answer: 1,
          why: "Your key bills you at the company's own price. Free mode uses companies' free plans, so it costs nothing.",
        },
      },
      {
        slug: "first-key",
        title: "Connect your first model",
        minutes: 3,
        goal: "Have at least one AI model ready to chat with.",
        film: "connect",
        steps: [
          { title: "Open Models and keys", body: "In the web app, click Connect a model (or the key button at the top right)." },
          { title: "Pick the company", body: "Choose Anthropic, OpenAI, Google or another. The form links straight to the page where that company makes keys." },
          { title: "Paste the key and check it", body: "Click Check key and connect. MoonlightC makes one real test call and lists every model the key unlocks." },
        ],
        tip: "No key yet? Use Free instead: the next lesson shows how, with free plans that need no card.",
        check: {
          q: "What happens when you click Check key and connect?",
          options: ["The key is emailed to MoonlightC", "A real test call is made and your models are listed", "Nothing until you send a message"],
          answer: 1,
          why: "The check proves the key works before you rely on it. Keys stay on your device.",
        },
        go: { label: "Open the web app", href: "/app" },
      },
      {
        slug: "free",
        title: "Use AI for free",
        minutes: 4,
        goal: "Chat with no paid plan, using companies' free tiers.",
        steps: [
          { title: "Get a free key", body: "In Models and keys, the Start free section lists companies with free plans (Google AI Studio, Groq, Cerebras, OpenRouter and more). Each button opens that company's key page." },
          { title: "Add it", body: "Paste the key and connect, like any other. Its Use in Free switch is on by default." },
          { title: "Pick Free in the model menu", body: "Free goes through every free model you have. When one hits its limit, the next one answers and that one rests for a while." },
          { title: "Choose your own list (optional)", body: "In Models and keys, under Free models, pick Only the ones I pick and tick the models you want." },
        ],
        tip: "Two or three free companies together give you far more free messages a day than one.",
        check: {
          q: "A free model hits its limit mid-conversation. What does Free do?",
          options: ["Shows an error and stops", "Moves to the next free model and rests the busy one", "Charges your card"],
          answer: 1,
          why: "Free remembers which models are resting and skips them until their rest is over.",
        },
        go: { label: "Open Models and keys", href: "/app" },
      },
      {
        slug: "first-chat",
        title: "Chat, switch, and keep going",
        minutes: 3,
        goal: "Send messages, switch models mid-chat, and edit or retry.",
        film: "switch",
        steps: [
          { title: "Send a message", body: "Type and press Enter. Shift+Enter makes a new line." },
          { title: "Switch models", body: "Click the model's name under the message box and pick another. The new model continues the same conversation." },
          { title: "Fix your last message", body: "Press the Up arrow in an empty message box to edit what you just sent." },
          { title: "Let it choose", body: "Pick Auto, and MoonlightC uses the model you set for each kind of task (coding, quick questions, deep thinking). Set them in Settings, then Auto model." },
        ],
        check: {
          q: "How do you edit the message you just sent?",
          options: ["Delete the chat", "Press the Up arrow in an empty message box", "Email support"],
          answer: 1,
          why: "Up arrow opens your last message for editing, like in many chat apps.",
        },
      },
    ],
  },
  {
    id: "everyday",
    title: "Everyday chatting",
    summary: "Commands, modes, projects, memory and privacy.",
    lessons: [
      {
        slug: "commands",
        title: "Commands: type / and a word",
        minutes: 3,
        goal: "Do common jobs in a few keystrokes, and make your own commands.",
        steps: [
          { title: "Open the menu", body: "Type / in the message box. Every command appears; keep typing to narrow it. Tab fills one in, Enter runs it." },
          { title: "Try a few", body: "Commands are plain words, then what you want.", code: "/translate spanish good morning\n/summarize\n/email ask my landlord to fix the heater\n/model claude\n/new" },
          { title: "Make your own", body: "Settings, then Commands. Give it a name and the message it sends. {input} is where your text goes.", code: "Name:  tweet\nSends: Turn this into a short, punchy tweet: {input}\n\nThen type:  /tweet we just launched" },
        ],
        tip: "A command of yours with the same name as a built-in one replaces it, so you can change how any command works.",
        check: {
          q: "What does {input} mean in your own command?",
          options: ["The AI's last answer", "Whatever you type after the command's name", "Your API key"],
          answer: 1,
          why: "/tweet we just launched sends your prompt with {input} replaced by \"we just launched\".",
        },
        go: { label: "Try it in the app", href: "/app" },
      },
      {
        slug: "modes",
        title: "Modes",
        minutes: 2,
        goal: "Change how the AI answers: general, research, private and your own.",
        steps: [
          { title: "Open the mode menu", body: "Click the mode button under the message box (it says General)." },
          { title: "Pick one", body: "Each mode sets the AI's instructions and creativity. More options shows every mode." },
          { title: "Make your own", body: "Settings, then Modes. Write instructions once (\"answer like a patient teacher\") and pin the mode to the top." },
        ],
        check: {
          q: "Where do you make your own mode?",
          options: ["Settings, then Modes", "In the browser's settings", "You can't"],
          answer: 0,
          why: "Settings, then Modes lets you create, edit and pin modes.",
        },
      },
      {
        slug: "projects",
        title: "Projects",
        minutes: 3,
        goal: "Group chats that share instructions, files and tools.",
        film: "projects",
        steps: [
          { title: "Create one", body: "In the left bar, click Projects, then New project." },
          { title: "Give it instructions and files", body: "Every chat inside it follows them, whichever model you use." },
          { title: "Chat inside it", body: "Click New chat in the project. You can also move a chat into a project from the project menu under the message box." },
        ],
        check: {
          q: "What do chats in a project share?",
          options: ["Nothing", "The project's instructions and files", "Only the title"],
          answer: 1,
          why: "Projects keep context together so you don't repeat yourself.",
        },
      },
      {
        slug: "memory-privacy",
        title: "Memory and private chats",
        minutes: 3,
        goal: "Decide what the AI remembers, and chat without a trace.",
        film: "memory",
        steps: [
          { title: "Memory is off until you turn it on", body: "Settings, then Memory, then Let the AI remember things. Click Save changes." },
          { title: "See and delete every fact", body: "Each remembered fact is listed. Edit or delete any of them at any time." },
          { title: "Private mode", body: "Pick Private in the mode menu. A private chat is never saved, and it disappears when you start a new one." },
        ],
        check: {
          q: "Is memory on when you first start?",
          options: ["Yes, always", "No, it's off until you turn it on", "Only for paid users"],
          answer: 1,
          why: "Nothing is remembered unless you switch it on, and you can delete each fact.",
        },
      },
      {
        slug: "files-voice-tools",
        title: "Files, voice and web tools",
        minutes: 3,
        goal: "Attach files, talk instead of typing, and let the AI search the web.",
        steps: [
          { title: "Attach", body: "Click the paperclip, drag files onto the chat, or paste a picture. Images, PDFs and text or code files work." },
          { title: "Talk", body: "The microphone turns speech into text. The talk button next to it has a spoken conversation." },
          { title: "Tools", body: "Click Tools under the message box (or type /tools) so the AI can read links and run Python. Add a search key in Models and keys and it can search the web too." },
        ],
        check: {
          q: "What does the Tools switch let the AI do?",
          options: ["Read links, run Python and (with a search key) search the web", "Change your password", "Install apps"],
          answer: 0,
          why: "Tools gives the AI the web and a Python sandbox, only while it's on.",
        },
      },
    ],
  },
  {
    id: "make",
    title: "Make things",
    summary: "Apps beside the chat, images and video, and real code projects.",
    lessons: [
      {
        slug: "apps",
        title: "Apps that run beside the chat",
        minutes: 2,
        goal: "Ask for a tool, game or page and use it right away.",
        steps: [
          { title: "Ask for it", body: "\"Make a tip calculator\" or \"a flashcard quiz on French verbs\"." },
          { title: "Use it", body: "It opens in a panel beside the chat and works immediately. Switch between Preview and Code at the top of the panel." },
          { title: "Change it by talking", body: "\"Make the buttons bigger\" updates it in place." },
        ],
        check: {
          q: "Where does an app the AI makes appear?",
          options: ["In a panel beside the chat, ready to use", "Only as a download", "Nowhere"],
          answer: 0,
          why: "You can use it straight away and keep refining it.",
        },
      },
      {
        slug: "studio",
        title: "Images, video and voices",
        minutes: 4,
        goal: "Make pictures, short videos and speech in Studio.",
        steps: [
          { title: "Open Studio", body: "In the left bar, click Studio." },
          { title: "Add a media key", body: "Images work with a fal, OpenAI, Google, xAI or Replicate key. Video works with fal, xAI or Replicate. Voices with fal, OpenAI or ElevenLabs." },
          { title: "Describe it", body: "Say what you want to see: subject, style, light and framing. Everything you make is kept in your gallery." },
        ],
        tip: "Be specific: \"a brass lantern on a rainy window sill, soft morning light, close-up\" beats \"a nice lantern\".",
        check: {
          q: "Which key works for images, video and voices all at once?",
          options: ["fal", "A search key", "GitHub"],
          answer: 0,
          why: "fal offers many image, video and voice models with one key.",
        },
      },
      {
        slug: "code",
        title: "Build an app in Code",
        minutes: 5,
        goal: "Describe an app, watch it run, and download it or put it on GitHub.",
        film: "code",
        steps: [
          { title: "Start a code project", body: "Click Code at the top, then New code project, and name it." },
          { title: "Describe it", body: "The AI writes the files. Open Preview to use the app right there." },
          { title: "Choose how much it does alone", body: "Pick Ask before changes, Auto-accept edits or Plan only. Changes it makes can be undone." },
          { title: "Keep it", body: "Download it as a .zip, or connect GitHub and click Put on GitHub." },
        ],
        check: {
          q: "How do you see the app working?",
          options: ["Open Preview in the Code tab", "Email it to yourself", "Print it"],
          answer: 0,
          why: "Preview runs the app inside MoonlightC as soon as it's written.",
        },
        go: { label: "Open Code", href: "/app" },
      },
      {
        slug: "ship",
        title: "Put your app online with Vercel and Supabase",
        minutes: 8,
        goal: "Publish a Code project on the web, with a real database behind it.",
        steps: [
          { title: "Put it on GitHub", body: "In Code, connect GitHub (Settings, then Connectors), then click Put on GitHub. Your project gets its own repository." },
          { title: "Deploy on Vercel", body: "In the project's menu, click Deploy on Vercel. Vercel opens with your repository chosen; sign in (it's free for personal projects) and click Deploy. You get a web address anyone can open." },
          { title: "Add a database with Supabase", body: "Settings, then Connectors, then Supabase under Connect with one click. Sign in to Supabase and approve. Now ask the AI: \"Create a Supabase project called notes with a table for notes\"." },
          { title: "Connect the two", body: "Ask the AI to use Supabase in your app. It writes the code; Supabase gives you a project URL and a public (anon) key. In Vercel, open your project, then Settings, then Environment Variables, and add them there, never in the code." },
          { title: "Check from chat", body: "Connect Vercel too (Settings, then Connectors, then Vercel). Ask \"Did my last deployment work?\" and the AI reads it for you." },
        ],
        tip: "The AI asks before it changes anything in a connected account. Read each request before you click Allow.",
        check: {
          q: "Where should your Supabase keys go for the live site?",
          options: ["Pasted into the code", "Vercel's Environment Variables", "A public GitHub issue"],
          answer: 1,
          why: "Environment variables keep keys out of your code and out of GitHub.",
        },
      },
    ],
  },
  {
    id: "connect",
    title: "Connect your stuff",
    summary: "Connectors, GitHub and Google, your own servers, and plugins.",
    lessons: [
      {
        slug: "connectors",
        title: "One-click connectors",
        minutes: 3,
        goal: "Let the AI read and act in Notion, Linear, Vercel, Supabase and more.",
        steps: [
          { title: "Open Connectors", body: "Settings, then Connectors. Under Connect with one click, pick a service." },
          { title: "Sign in and approve", body: "You sign in on the service's own page. MoonlightC never sees your password." },
          { title: "Ask about it", body: "\"What's on my Linear board this week?\" The AI asks before it changes anything." },
        ],
        check: {
          q: "Who sees your password when you connect Notion?",
          options: ["MoonlightC", "Only Notion, on its own sign-in page", "The AI model"],
          answer: 1,
          why: "Connectors use the service's own sign-in, so your password stays with them.",
        },
      },
      {
        slug: "github-google",
        title: "GitHub and Google",
        minutes: 3,
        goal: "Work with your repositories, Gmail, Calendar and Drive from chat.",
        steps: [
          { title: "GitHub", body: "Settings, then Connectors, then GitHub. Once connected, the AI can read issues and code, and Code can publish projects." },
          { title: "Google", body: "Settings, then Connectors, then Google. Then ask: \"What's on my calendar tomorrow?\" or \"Find the email from my landlord\"." },
          { title: "Projects choose", body: "In a project, choose which connectors its chats may use." },
        ],
        check: {
          q: "What does connecting GitHub add to Code?",
          options: ["Put on GitHub for your projects", "Nothing", "A new theme"],
          answer: 0,
          why: "With GitHub connected, Code can publish a project to its own repository.",
        },
      },
      {
        slug: "plugins",
        title: "Claude plugins and mods",
        minutes: 3,
        goal: "Add skills, commands and tools other people made.",
        steps: [
          { title: "Open Plugins & mods", body: "Settings, then Plugins & mods. Browse the catalog or paste a GitHub link to a Claude plugin." },
          { title: "What you get", body: "Skills (know-how the AI uses when it fits), slash commands (they show up in the / menu), and connectors." },
          { title: "Turn them on per project", body: "A project can use only the plugins it needs." },
        ],
        check: {
          q: "Where do a plugin's slash commands appear?",
          options: ["In the / menu in the message box", "In your email", "Nowhere"],
          answer: 0,
          why: "Plugin commands join the / menu, marked Plugin.",
        },
      },
    ],
  },
  {
    id: "pc",
    title: "Your PC and your browser",
    summary: "The desktop app, Claude Code, remote control and the Chrome extension.",
    lessons: [
      {
        slug: "desktop",
        title: "The desktop app",
        minutes: 3,
        goal: "Install MoonlightC on Windows, Mac or Linux.",
        steps: [
          { title: "Download", body: "Open the Download page. It picks the right file for your computer." },
          { title: "Install", body: "Windows may say \"Windows protected your PC\" because builds aren't code-signed yet: click More info, then Run anyway. On a Mac, drag it into Applications." },
          { title: "What it adds", body: "Models running on your own PC, Claude Code, terminals in your real folders, files, and remote control." },
        ],
        check: {
          q: "What does the desktop app add over the web app?",
          options: ["Your own PC: local models, Claude Code, files, remote control", "Nothing", "Ads"],
          answer: 0,
          why: "The web app works anywhere; the desktop app brings your PC into it.",
        },
        go: { label: "Go to Download", href: "/download" },
      },
      {
        slug: "claude-code",
        title: "Connect Claude Code",
        minutes: 6,
        goal: "Use your Claude plan inside MoonlightC through Claude Code.",
        steps: [
          { title: "Install Claude Code on the PC", body: "In the desktop app, open Code, then a terminal (or any terminal on the PC). On Windows run the first line; on Mac or Linux, the second.", code: "irm https://claude.ai/install.ps1 | iex\ncurl -fsSL https://claude.ai/install.sh | bash" },
          { title: "Start it and sign in", body: "Type claude and press Enter, then /login. Pick Claude account with subscription.", code: "claude\n/login" },
          { title: "Not at that PC? Use the code", body: "If the sign-in page opens on a different device, it can't reach the PC and shows \"This site can't be reached\". Instead, copy the link under \"Browser didn't open? Use the url below to sign in\", open it, click Authorize, copy the code it shows, and paste it where the terminal says Paste code here." },
          { title: "Use it", body: "Type /exit. MoonlightC finds Claude Code on its own: Claude Code (your plan) appears in the model menu, and Code can run it in your projects." },
        ],
        tip: "If it says your session expired, run claude then /login again. Your projects and chats stay where they are.",
        check: {
          q: "You click Authorize on your phone and get \"This site can't be reached\". What now?",
          options: ["Reinstall Windows", "Use the link under \"Browser didn't open?\" and paste the code it shows", "Wait a week"],
          answer: 1,
          why: "The automatic link only works on the PC itself; the code works from any device.",
        },
      },
      {
        slug: "remote",
        title: "Use your PC from anywhere",
        minutes: 5,
        goal: "See and control your home PC from your phone or Chromebook, safely.",
        steps: [
          { title: "Install and switch it on", body: "Install the desktop app on the PC. In Settings, then Remote control, turn it on." },
          { title: "Two-step sign-in", body: "Remote control only works on accounts with a second step, like an authenticator code. Set it up in Settings, then Account." },
          { title: "Connect from another device", body: "Open MoonlightC on your phone, pick your PC and connect. The first time, the PC asks, and nothing connects until you allow it." },
          { title: "Stay in control", body: "The PC shows a banner while someone is connected, with a button to end it. Each device gets only the abilities you choose." },
        ],
        check: {
          q: "Can a new device control your PC without your OK?",
          options: ["Yes", "No: the PC asks first, and remote control needs two-step sign-in", "Only on weekends"],
          answer: 1,
          why: "Approval on the PC and a second sign-in step are both required.",
        },
        go: { label: "Read about remote control", href: "/remote" },
      },
      {
        slug: "extension",
        title: "Let the AI use a browser tab",
        minutes: 4,
        goal: "Share one tab and have the AI read, click and type there.",
        steps: [
          { title: "Install the extension", body: "Follow the steps on the Chrome extension page (Chrome or Edge on a computer)." },
          { title: "Share a tab", body: "On any tab, click the MoonlightC icon, then Share this tab. Tabs you don't share stay private." },
          { title: "Ask in Cowork", body: "\"Summarize this article\" or \"fill in this form with my details\". Risky steps, like sending, wait for your OK." },
          { title: "Stop any time", body: "Click Stop on the tab's banner, or press Alt+Shift+M to stop sharing every tab." },
        ],
        check: {
          q: "Which tabs can the AI see?",
          options: ["Every tab you have open", "Only tabs you shared with Share this tab", "Your whole history"],
          answer: 1,
          why: "Nothing is visible to the AI until you share that tab.",
        },
        go: { label: "Get the extension", href: "/extension" },
      },
    ],
  },
  {
    id: "yours",
    title: "Make it yours",
    summary: "Looks, layouts and how the app behaves, previewed before you save.",
    lessons: [
      {
        slug: "themes",
        title: "Themes and appearance",
        minutes: 3,
        goal: "Change colors, fonts and layout, and see it before you keep it.",
        film: "theme",
        steps: [
          { title: "Open Appearance", body: "Settings, then Appearance." },
          { title: "Preview anything", body: "Click a theme or change any option. The whole app changes right away so you can see it." },
          { title: "Save or reset", body: "A bar at the bottom says you have unsaved changes. Save changes keeps them; Reset puts everything back." },
          { title: "Make your own theme", body: "Edit colors in the theme editor and save it under your name." },
        ],
        check: {
          q: "You tried a theme and don't like it. What do you click?",
          options: ["Reset in the unsaved changes bar", "Uninstall the app", "Nothing; it's permanent"],
          answer: 0,
          why: "Changes are a preview until you click Save changes.",
        },
      },
      {
        slug: "safety",
        title: "Your keys and data",
        minutes: 2,
        goal: "Know where things are kept and how to take them with you.",
        steps: [
          { title: "Keys stay on your device", body: "Keys are kept on this device, and only their last 4 characters are ever shown. Exports leave keys out." },
          { title: "Export and import", body: "Settings, then Privacy & data: export everything, or bring in chats from ChatGPT or Claude export files." },
          { title: "Open source", body: "Every line is on GitHub under the MIT license. Read it, change it, or run your own copy." },
        ],
        check: {
          q: "How much of a key does MoonlightC show you?",
          options: ["All of it", "The last 4 characters", "It emails it to you"],
          answer: 1,
          why: "Showing only the end lets you tell keys apart without exposing them.",
        },
      },
    ],
  },
];

export const LESSONS_FLAT = COURSE.flatMap((m) => m.lessons.map((l) => ({ ...l, module: m })));
export const totalMinutes = LESSONS_FLAT.reduce((n, l) => n + l.minutes, 0);
export const lessonAt = (slug: string) => {
  const i = LESSONS_FLAT.findIndex((l) => l.slug === slug);
  return i < 0 ? undefined : { lesson: LESSONS_FLAT[i], prev: LESSONS_FLAT[i - 1], next: LESSONS_FLAT[i + 1], index: i };
};
