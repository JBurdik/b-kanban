import type { ElectrobunConfig } from "electrobun";

export default {
  app: {
    name: "B Productive",
    identifier: "net.burdych.bproductive",
    version: "0.1.0",
  },
  runtime: {
    exitOnLastWindowClosed: true,
  },
  build: {
    bun: {
      entrypoint: "src-electrobun/main.ts",
    },
  },
} satisfies ElectrobunConfig;
