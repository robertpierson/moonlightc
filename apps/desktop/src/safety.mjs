const RISKY_KEYS = /^(delete|shift\+delete)$/i;
const RISKY_TEXT = /\b(rm\s+-rf|del\s+\/|format\s+[a-z]:|rmdir\s+\/s|shutdown|Remove-Item)\b/i;

/** Second line of defense for computer use; the model must also flag destructive steps itself. */
export function looksDestructive(a) {
  if (a.destructive) return true;
  if (a.action === "key" && RISKY_KEYS.test(a.keys ?? "")) return true;
  if (a.action === "type" && RISKY_TEXT.test(a.text ?? "")) return true;
  return false;
}
