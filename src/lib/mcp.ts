// MCP installer bridge (desktop only). Thin wrappers over the Rust `mcp_*`
// Tauri commands. Safe to call anywhere — they no-op/throw outside Tauri.

export type McpTarget = "claude" | "codex";

export type McpStatus = {
  node_path: string | null;
  server_path: string | null;
  claude_installed: boolean;
  codex_installed: boolean;
  claude_skill: boolean;
  codex_skill: boolean;
};

async function core() {
  return import("@tauri-apps/api/core");
}

export async function mcpStatus(): Promise<McpStatus | null> {
  try {
    const { invoke } = await core();
    return await invoke<McpStatus>("mcp_status");
  } catch {
    return null;
  }
}

export async function mcpInstall(
  target: McpTarget,
  convexUrl: string,
  email: string,
): Promise<void> {
  const { invoke } = await core();
  await invoke("mcp_install", { target, convexUrl, email });
}

export async function mcpUninstall(target: McpTarget): Promise<void> {
  const { invoke } = await core();
  await invoke("mcp_uninstall", { target });
}

export async function skillInstall(target: McpTarget): Promise<void> {
  const { invoke } = await core();
  await invoke("skill_install", { target });
}

export async function skillUninstall(target: McpTarget): Promise<void> {
  const { invoke } = await core();
  await invoke("skill_uninstall", { target });
}

/** Persist (or clear) the currently-open card for external MCP clients. */
export async function mcpSetActiveCard(card: unknown | null): Promise<void> {
  try {
    const { invoke } = await core();
    await invoke("mcp_set_active_card", {
      payload: card ? JSON.stringify(card) : null,
    });
  } catch {
    // not in Tauri — ignore
  }
}
