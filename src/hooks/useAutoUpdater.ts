import { useState, useEffect, useCallback } from "react";
import { isDesktop } from "@/lib/platform";

type UpdateState = "idle" | "available" | "downloading" | "ready";

export function useAutoUpdater() {
  const [state, setState] = useState<UpdateState>("idle");
  const [version, setVersion] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    if (!isDesktop) return;

    let unlisten: (() => void)[] = [];

    async function setup() {
      const { listen } = await import("@tauri-apps/api/event");
      const { invoke } = await import("@tauri-apps/api/core");

      unlisten.push(
        await listen<string>("update:available", (e) => {
          setVersion(e.payload);
          setState("available");
        }),
      );
      unlisten.push(
        await listen("update:downloading", () => setState("downloading")),
      );
      unlisten.push(
        await listen("update:ready", () => setState("ready")),
      );

      // Suppress unused variable warning — invoke is used in callbacks below
      void invoke;
    }

    setup();
    return () => unlisten.forEach((fn) => fn());
  }, []);

  const checkForUpdates = useCallback(async () => {
    if (!isDesktop || isChecking) return;
    setIsChecking(true);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("check_for_updates_cmd");
    } finally {
      setIsChecking(false);
    }
  }, [isChecking]);

  const installUpdate = useCallback(async () => {
    if (!isDesktop) return;
    setState("downloading");
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("install_update_cmd");
    } catch (e) {
      console.error("Update install failed:", e);
      setState("available");
    }
  }, []);

  return { state, version, isChecking, checkForUpdates, installUpdate };
}
