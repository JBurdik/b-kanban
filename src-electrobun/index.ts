import { BrowserWindow, Updater } from "electrobun/bun";

const DEV_SERVER_URL = "http://localhost:5173";

async function getMainViewUrl(): Promise<string> {
  const channel = await Updater.localInfo.channel();
  if (channel === "dev") {
    try {
      await fetch(DEV_SERVER_URL, { method: "HEAD" });
      console.log(`HMR enabled: Using Vite dev server at ${DEV_SERVER_URL}`);
      return DEV_SERVER_URL;
    } catch {
      console.log(
        "Vite dev server not running. Start it with 'pnpm dev:app'.",
      );
    }
  }
  return "views://mainview/index.html";
}

const url = await getMainViewUrl();

const mainWindow = new BrowserWindow({
  title: "Be Productive",
  url,
  frame: {
    width: 900,
    height: 700,
    x: 200,
    y: 200,
  },
});

console.log("B Productive desktop app started!");
