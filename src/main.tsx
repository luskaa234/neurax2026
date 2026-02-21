import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker } from "./lib/registerServiceWorker";

function refreshFavicons() {
  const version = "v6";
  const targets: Array<[string, string]> = [
    ['link[rel="shortcut icon"]', `/favicon-n.ico?${version}`],
    ['link[rel="icon"][sizes="16x16"]', `/icons/favicon-16.png?${version}`],
    ['link[rel="icon"][sizes="32x32"]', `/icons/favicon-32.png?${version}`],
    ['link[rel="icon"][sizes="48x48"]', `/icons/favicon-48.png?${version}`],
    ['link[rel="icon"][type="image/svg+xml"]', `/icons/icon-n.svg?${version}`],
  ];

  for (const [selector, href] of targets) {
    const node = document.querySelector<HTMLLinkElement>(selector);
    if (node) node.href = href;
  }
}

createRoot(document.getElementById("root")!).render(<App />);
refreshFavicons();
if (import.meta.env.PROD) {
  registerServiceWorker();
}
