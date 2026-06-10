import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";

export function useAppVersion(): string {
  const [version, setVersion] = useState<string>(__APP_VERSION__);

  useEffect(() => {
    if (!isTauri()) return;
    import("@tauri-apps/api/app")
      .then((m) => m.getVersion())
      .then(setVersion)
      .catch(() => {});
  }, []);

  return version;
}
