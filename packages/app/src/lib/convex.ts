import { ConvexReactClient } from "convex/react";

export const convex = new ConvexReactClient(
  import.meta.env.VITE_CONVEX_URL as string,
  {
    // Pause queries until the user is authenticated
    expectAuth: true,
  }
);
