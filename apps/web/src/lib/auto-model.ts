import type { ModelRef } from "./store";

// "Auto" picks a model for each message from the ones the user assigned to each kind of task in Settings.
// ponytail: keyword heuristics, swap for a small classifier model if people report wrong picks.

export const TASKS = [
  { id: "everyday", name: "Everyday", hint: "Questions, writing and chat. Also used when a task has no model of its own." },
  { id: "coding", name: "Coding", hint: "Code, errors, scripts and technical questions." },
  { id: "thinking", name: "Deep thinking", hint: "Math, planning, analysis and long, detailed requests." },
  { id: "quick", name: "Quick answers", hint: "Short, simple questions. A fast, cheap model is ideal." },
  { id: "vision", name: "Pictures", hint: "Messages with an image attached. Pick a model that can see images." },
] as const;
export type TaskKind = (typeof TASKS)[number]["id"];
export type AutoPicks = Partial<Record<TaskKind, ModelRef>>;

export const AUTO: ModelRef = { connectionId: "auto", modelId: "auto" };
export const isAuto = (r?: ModelRef) => r?.connectionId === AUTO.connectionId;

const CODE = /```|\b(function|const|let|def|class|import|npm|pnpm|pip|git|bug|stack ?trace|exception|compile|typescript|javascript|python|rust|golang|java|c\+\+|c#|sql|regex|json|html|css|react|node|api|endpoint|script|code|debug|refactor)\b|[{};]\s*$/im;
const THINK = /\b(prove|proof|step[- ]by[- ]step|analy[sz]e|analysis|derive|calculate|solve|equation|optimi[sz]e|trade-?offs?|pros and cons|strategy|plan out|in depth|thoroughly)\b/i;

export function classifyTask(text: string, hasImage = false): TaskKind {
  if (hasImage) return "vision";
  if (CODE.test(text)) return "coding";
  if (THINK.test(text) || text.length > 600) return "thinking";
  if (text.trim().length < 60) return "quick";
  return "everyday";
}

/** The model for this kind of task, falling back to the Everyday pick. */
export function resolveAuto(kind: TaskKind, picks: AutoPicks = {}) {
  return picks[kind] ?? picks.everyday;
}
