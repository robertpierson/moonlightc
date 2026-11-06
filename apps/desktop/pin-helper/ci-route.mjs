// CI only, at normal rights: the same calls MoonlightC makes for a remote device's input.
//   node ci-route.mjs type-and-enter | click <x> <y> | not-in-front
import { boxInFront, closeBox, sendToBox } from "../src/credential-box.mjs";

const [mode, x, y] = process.argv.slice(2);
const at = () => ({ x: Number(x), y: Number(y) });
const show = (label, v) => console.log(`${label}: ${v}`);
show("box in front", boxInFront());
if (mode === "type-and-enter") {
  show("type name", await sendToBox({ action: "type", text: "routeduser" }, at));
  show("tab", await sendToBox({ action: "key", keys: "tab" }, at));
  // Number keys held and released one by one, the way a keyboard sends them.
  for (const k of ["7", "3"]) {
    show(`down ${k}`, await sendToBox({ action: "key_down", key: k }, at));
    show(`up ${k}`, await sendToBox({ action: "key_up", key: k }, at));
  }
  show("Ctrl refused", !(await sendToBox({ action: "key", keys: "ctrl+v" }, at)));
  show("enter", await sendToBox({ action: "key", keys: "enter" }, at));
} else if (mode === "click") {
  show("click", await sendToBox({ action: "click" }, at));
} else {
  show("handled", await sendToBox({ action: "type", text: "x" }, at));
}
closeBox();
process.exit(0);
