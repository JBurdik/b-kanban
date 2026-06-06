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
import { isNative } from "./lib/platform";
import "./index.css";

// Use hash-based routing in native shells (Electrobun desktop + Capacitor mobile),
// which have no server to handle deep links.
const history = isNative ? createHashHistory() : undefined;

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
