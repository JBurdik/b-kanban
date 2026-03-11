import { BrowserWindow } from "electrobun/bun";

// In dev mode, set ELECTROBUN_DEV=1 and run the Vite dev server separately.
// In production builds, the app is served from the views:// scheme.
const devUrl = process.env.ELECTROBUN_DEV
  ? "http://localhost:5173"
  : undefined;

const win = new BrowserWindow({
  title: "Be Productive",
  frame: {
    width: 800,
    height: 600,
  },
  url: devUrl ?? "views://main/index.html",
});
