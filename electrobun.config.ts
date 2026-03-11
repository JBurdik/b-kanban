import type { ElectrobunConfig } from "electrobun";

export default {
  app: {
    name: "B Productive",
    identifier: "net.burdych.bproductive",
    version: "0.1.0",
  },
  build: {
    bun: {
      entrypoint: "src-electrobun/index.ts",
    },
    copy: {
      "dist/index.html": "views/mainview/index.html",
      "dist/assets": "views/mainview/assets",
      "dist/icon.svg": "views/mainview/icon.svg",
      "dist/icon.png": "views/mainview/icon.png",
    },
    watchIgnore: ["dist/**"],
    mac: {
      codesign: false,
      notarize: false,
    },
  },
  release: {
    baseUrl: "https://github.com/JBurdik/b-kanban/releases/latest/download",
  },
} satisfies ElectrobunConfig;
