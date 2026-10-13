const q = new URLSearchParams(location.search);
document.getElementById("what").textContent = `The AI wants to ${q.get("what")}`;
document.getElementById("site").textContent = `On ${q.get("site")}`;
const answer = (allow) => chrome.runtime.sendMessage({ from: "confirm", id: q.get("id"), allow }).finally(() => window.close());
document.getElementById("allow").onclick = () => answer(true);
document.getElementById("deny").onclick = () => answer(false);
