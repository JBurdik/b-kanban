import { ApplicationMenu, BrowserWindow, BrowserView, Updater } from "electrobun/bun";
import Electrobun from "electrobun/bun";
import type { RPCSchema } from "electrobun/bun";

const DEV_SERVER_URL = "http://localhost:5173";
const UPDATE_CHECK_INTERVAL = 30 * 60 * 1000; // 30 minutes

ApplicationMenu.setApplicationMenu([
  {
    submenu: [{ label: "Quit", role: "quit" }],
  },
  {
    label: "Edit",
    submenu: [
      { role: "undo" },
      { role: "redo" },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { role: "pasteAndMatchStyle" },
      { role: "delete" },
      { role: "selectAll" },
    ],
  },
]);

async function getMainViewUrl(): Promise<string> {
  const channel = await Updater.localInfo.channel();
  if (channel === "dev") {
    try {
      await fetch(DEV_SERVER_URL, { method: "HEAD" });
      console.log(`HMR enabled: Using Vite dev server at ${DEV_SERVER_URL}`);
      return DEV_SERVER_URL;
    } catch {
      console.log("Vite dev server not running. Start it with 'pnpm dev:app'.");
    }
  }
  return "views://mainview/index.html";
}

async function checkForUpdates() {
  const channel = await Updater.localInfo.channel();
  if (channel === "dev") return;

  try {
    const updateInfo = await Electrobun.Updater.checkForUpdate();
    if (updateInfo.updateReady) {
      console.log(`Update ready: ${updateInfo.version}`);
      await Electrobun.Updater.applyUpdate();
    } else if (updateInfo.updateAvailable) {
      console.log(`Update available: ${updateInfo.version}, downloading...`);
    }
  } catch (err) {
    console.error("Update check failed:", err);
  }
}

const url = await getMainViewUrl();

const mainWindow = new BrowserWindow({
  title: "Be Productive",
  url,
  rpc: mainRPC,
  frame: {
    width: 1024,
    height: 920,
    x: 200,
    y: 200,
  },
});

console.log("B Productive desktop app started!");

// Check for updates on startup and periodically
checkForUpdates();
setInterval(checkForUpdates, UPDATE_CHECK_INTERVAL);
