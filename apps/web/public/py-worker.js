// Runs Python with Pyodide off the main thread. Workers have no access to localStorage, so saved keys stay out of reach.
import { loadPyodide } from "https://cdn.jsdelivr.net/pyodide/v314.0.7/full/pyodide.mjs";
let ready;
self.onmessage = async ({ data: { id, code } }) => {
  let out = "";
  try {
    ready ??= loadPyodide();
    const py = await ready;
    py.setStdout({ batched: (s) => (out += s + "\n") });
    py.setStderr({ batched: (s) => (out += s + "\n") });
    await py.loadPackagesFromImports(code);
    const result = await py.runPythonAsync(code);
    const value = result === undefined || result === null ? "" : String(result);
    self.postMessage({ id, output: (out + value).slice(0, 20000) });
  } catch (e) {
    self.postMessage({ id, output: out.slice(0, 10000), error: String(e).slice(-4000) });
  }
};
