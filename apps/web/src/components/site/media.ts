// Pictures of the real app, imported so their addresses carry a fingerprint of the file: a re-filmed picture can
// never be served from an old cached copy. Made by scripts/demo/lessons.mjs.
import type { StaticImageData } from "next/image";
import shot_chat from "../../../public/shots/chat.webp";
import shot_code from "../../../public/shots/code.webp";
import shot_connections from "../../../public/shots/connections.webp";
import shot_memory from "../../../public/shots/memory.webp";
import shot_models from "../../../public/shots/models.webp";
import shot_plugins from "../../../public/shots/plugins.webp";
import shot_private from "../../../public/shots/private.webp";
import shot_projects from "../../../public/shots/projects.webp";
import shot_theme from "../../../public/shots/theme.webp";
import poster_connect from "../../../public/learn/connect.webp";
import poster_switch from "../../../public/learn/switch.webp";
import poster_projects from "../../../public/learn/projects.webp";
import poster_code from "../../../public/learn/code.webp";
import poster_private from "../../../public/learn/private.webp";
import poster_memory from "../../../public/learn/memory.webp";
import poster_theme from "../../../public/learn/theme.webp";

/** Screenshots of the app's screens. */
export const SHOTS: Record<string, StaticImageData> = { chat: shot_chat, code: shot_code, connections: shot_connections, memory: shot_memory, models: shot_models, plugins: shot_plugins, private: shot_private, projects: shot_projects, theme: shot_theme };

/** The last frame of each lesson's film. */
export const POSTERS: Record<string, StaticImageData> = { connect: poster_connect, switch: poster_switch, projects: poster_projects, code: poster_code, private: poster_private, memory: poster_memory, theme: poster_theme };
