import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import {
  RouterProvider,
  createRouter,
  createHashHistory,
} from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { ConvexProvider } from "./components/ConvexProvider";
import { ThemeProvider } from "./contexts/ThemeContext";
import "./index.css";

// Use hash-based routing for Electrobun desktop app (views:// protocol)
const isDesktop = window.location.protocol === "views:";
const history = isDesktop ? createHashHistory() : undefined;

const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  history,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <ConvexProvider>
        <RouterProvider router={router} />
      </ConvexProvider>
    </ThemeProvider>
  </StrictMode>
);
