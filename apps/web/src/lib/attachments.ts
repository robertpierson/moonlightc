import type { FileUIPart } from "ai";

// Requests go through a Vercel function (4.5 MB body limit), so keep attachments small for now.
// ponytail: inline data URLs; move to Supabase Storage uploads when bigger files are needed.
export const MAX_TOTAL_BYTES = 3 * 1024 * 1024;

const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|jsonl|xml|ya?ml|toml|ini|env\.example|log|html?|css|scss|js|jsx|mjs|cjs|ts|tsx|py|rb|go|rs|java|kt|swift|c|h|cpp|hpp|cs|php|sh|ps1|bat|sql|r|lua|dart|vue|svelte)$/i;

export type Attachment =
  | { kind: "file"; part: FileUIPart; size: number }
  | { kind: "text"; name: string; text: string; size: number };

export function isSupported(f: File) {
  return f.type.startsWith("image/") || f.type === "application/pdf" || f.type.startsWith("text/") || TEXT_EXT.test(f.name);
}

const dataURL = (f: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(f);
  });

export async function readAttachment(f: File): Promise<Attachment> {
  if (f.type.startsWith("image/") || f.type === "application/pdf") {
    return { kind: "file", size: f.size, part: { type: "file", mediaType: f.type, filename: f.name, url: await dataURL(f) } };
  }
  return { kind: "text", name: f.name, text: await f.text(), size: f.size };
}

/** Text files ride along inside the message text so every model can read them. */
export function composeText(text: string, attachments: Attachment[]) {
  const files = attachments.filter((a) => a.kind === "text");
  if (files.length === 0) return text;
  const blocks = files.map((a) => `<file name="${a.name.replace(/"/g, "")}">\n${a.text}\n</file>`).join("\n\n");
  return `${blocks}\n\n${text}`;
}
