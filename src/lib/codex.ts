// Codex CLI bridge (desktop only).
//
// Thin typed wrappers around the Rust `codex_*` Tauri commands. All entry points
// are guarded by `isDesktop`; on web/mobile they resolve to inert values so the
// assistant UI simply doesn't render. `@tauri-apps/api/core` is lazy-imported so
// it never lands in the web/mobile bundle.

export type CodexStatus = {
  installed: boolean;
  authed: boolean;
  version: string | null;
  path: string | null;
};

export type CodexEvent =
  | { kind: "started"; session_id: string }
  | { kind: "message"; text: string }
  | { kind: "final"; text: string; session_id: string }
  | { kind: "error"; message: string };

export type CodexResult = { session_id: string | null; final_text: string };

async function core() {
  return import("@tauri-apps/api/core");
}

/**
 * Ground-truth Tauri detection: can we actually reach the Rust backend?
 * We probe by invoking `codex_check`. In a browser there's no IPC, so `invoke`
 * throws → false. Inside Tauri it resolves → true. Returns the status too so
 * callers can avoid a second round-trip.
 */
export async function codexProbe(): Promise<CodexStatus | null> {
  try {
    const { invoke } = await core();
    const status = await invoke<CodexStatus>("codex_check");
    console.info("[codex] probe ok", status);
    return status;
  } catch (e) {
    console.warn("[codex] probe failed", e);
    return null;
  }
}

export async function codexCheck(): Promise<CodexStatus> {
  const { invoke } = await core();
  return invoke<CodexStatus>("codex_check");
}

export async function codexLogin(
  onLog?: (line: string) => void,
): Promise<void> {
  const { invoke } = await core();
  let unlisten: (() => void) | undefined;
  if (onLog) {
    const { listen } = await import("@tauri-apps/api/event");
    unlisten = await listen<string>("codex://login-log", (e) => onLog(e.payload));
  }
  try {
    await invoke("codex_login");
  } finally {
    unlisten?.();
  }
}

export async function codexSend(
  prompt: string,
  sessionId: string | null,
  onEvent: (e: CodexEvent) => void,
): Promise<CodexResult> {
  const { invoke, Channel } = await core();
  const channel = new Channel<CodexEvent>();
  channel.onmessage = onEvent;
  return invoke<CodexResult>("codex_send", {
    prompt,
    sessionId,
    onEvent: channel,
  });
}
