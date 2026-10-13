// Code interpreter: Python in a Web Worker (Pyodide). One worker is reused; a stuck run is killed after the timeout.
let worker: Worker | undefined;
let seq = 0;

export interface PyResult {
  output: string;
  error?: string;
}

export function runPython(code: string, timeoutMs = 60_000): Promise<PyResult> {
  worker ??= new Worker("/py-worker.js", { type: "module" });
  const w = worker;
  const id = ++seq;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      w.terminate();
      worker = undefined;
      resolve({ output: "", error: `Stopped after ${timeoutMs / 1000} seconds (time limit).` });
    }, timeoutMs);
    const onMessage = (e: MessageEvent<PyResult & { id: number }>) => {
      if (e.data.id !== id) return;
      clearTimeout(timer);
      w.removeEventListener("message", onMessage);
      resolve({ output: e.data.output, error: e.data.error });
    };
    w.addEventListener("message", onMessage);
    w.postMessage({ id, code });
  });
}
