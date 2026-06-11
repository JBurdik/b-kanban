import { ReactNode } from "react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { convex } from "@/lib/convex";

interface Props {
  children: ReactNode;
}

// Convex Auth provider. Manages access/refresh tokens in localStorage itself
// (works in the browser and in the Tauri/desktop webview), so the old
// better-auth bearer-token plumbing is no longer needed.
export function ConvexProvider({ children }: Props) {
  return <ConvexAuthProvider client={convex}>{children}</ConvexAuthProvider>;
}
