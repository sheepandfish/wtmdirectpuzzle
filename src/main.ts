import "./style.css";
import { Game } from "./game";

const ERROR_KEY = "groktest:last-error";

function showError(msg: string): void {
  let el = document.getElementById("fatal-error");
  if (!el) {
    el = document.createElement("div");
    el.id = "fatal-error";
    el.style.cssText =
      "position:fixed;left:12px;bottom:12px;z-index:9999;max-width:560px;padding:10px 12px;background:#4a1515;color:#fff;font:13px/1.45 sans-serif;border-radius:6px;white-space:pre-wrap;pointer-events:none;";
    document.body.appendChild(el);
  }
  el.textContent = msg;
}

function remember(msg: string): void {
  try {
    localStorage.setItem(ERROR_KEY, msg.slice(0, 1500));
  } catch {
    /* storage blocked */
  }
}

const previous = (() => {
  try {
    return localStorage.getItem(ERROR_KEY);
  } catch {
    return null;
  }
})();
if (previous) {
  showError("上次异常：\n" + previous);
  try {
    localStorage.removeItem(ERROR_KEY);
  } catch {
    /* ignore */
  }
}

window.addEventListener("error", (e) => {
  const msg = (e.error && (e.error as Error).stack) || e.message || String(e);
  remember(msg);
  showError(msg);
});
window.addEventListener("unhandledrejection", (e) => {
  const reason = e.reason as { stack?: string } | string;
  const msg = typeof reason === "string" ? reason : reason?.stack || String(reason);
  remember(msg);
  showError(msg);
});

const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
const hud = document.getElementById("hud-root") as HTMLElement;
canvas.addEventListener("webglcontextlost", (e) => {
  e.preventDefault();
  const msg = "WebGL 上下文丢失，画面已中断。请刷新页面后再试。";
  remember(msg);
  showError(msg);
});
new Game(canvas, hud);
