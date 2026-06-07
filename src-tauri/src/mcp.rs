//! MCP server installer.
//!
//! Writes the bundled B Productive MCP server to `~/.bproductive/` and registers
//! it in the config of MCP clients (Claude Desktop, Codex), so a single click in
//! the app's settings wires the kanban tools into those assistants.
//!
//! The server bundle is embedded at compile time (`include_str!`), so it's fully
//! self-contained — `node` runs it with no node_modules. Run `pnpm build:mcp`
//! before building the Rust crate (the dev/build scripts do this automatically).

use std::path::{Path, PathBuf};

use serde::Serialize;

/// The bundled MCP server (esbuild output). Produced by `pnpm build:mcp`.
const SERVER_JS: &str = include_str!("../resources/bproductive-mcp.mjs");

const SERVER_FILE: &str = "bproductive-mcp.mjs";

#[derive(Serialize)]
pub struct McpStatus {
    node_path: Option<String>,
    server_path: Option<String>,
    claude_installed: bool,
    codex_installed: bool,
    claude_skill: bool,
    codex_skill: bool,
}

const SKILL_NAME: &str = "bnotion";

/// Shared instructions for the /bnotion skill (Claude) / prompt (Codex).
const SKILL_BODY: &str = r#"# bnotion

Act as a Notion-like assistant over the user's **B Productive** kanban board,
using the `bproductive` MCP server tools.

When the user refers to "this card" / "the task I'm looking at", call
`get_active_card` first — it returns the card currently open in the desktop app
(boardId, slug, title, description).

Available tools:
- `get_active_card` — the card open in the app right now (or null).
- `list_boards` — all boards (boardId, name).
- `get_board` — a board's columns and cards.
- `create_card` — create a card in a column (description is Markdown).
- `update_card` — edit a card by slug (only provided fields change).
- `add_comment` — comment on a card by slug.

Rules:
- Verify a board/column name exists (via `get_board`) before creating.
- Descriptions are Markdown.
- Reference cards by their slug (e.g. STAT-12).
- Be concise. Confirm what you changed (slug + what).
"#;

fn claude_skill_path() -> Option<PathBuf> {
    home().map(|h| h.join(format!(".claude/skills/{SKILL_NAME}/SKILL.md")))
}

fn codex_prompt_path() -> Option<PathBuf> {
    home().map(|h| h.join(format!(".codex/prompts/{SKILL_NAME}.md")))
}

fn claude_skill_installed() -> bool {
    claude_skill_path().map(|p| p.is_file()).unwrap_or(false)
}

fn codex_skill_installed() -> bool {
    codex_prompt_path().map(|p| p.is_file()).unwrap_or(false)
}

fn home() -> Option<PathBuf> {
    dirs::home_dir()
}

fn bproductive_dir() -> Option<PathBuf> {
    home().map(|h| h.join(".bproductive"))
}

fn server_path() -> Option<PathBuf> {
    bproductive_dir().map(|d| d.join(SERVER_FILE))
}

fn active_card_path() -> Option<PathBuf> {
    bproductive_dir().map(|d| d.join("active.json"))
}

/// Resolve a `node` binary. GUI-launched apps don't inherit shell PATH, so probe
/// known locations + fall back to the login shell.
fn resolve_node() -> Option<PathBuf> {
    if let Ok(p) = std::env::var("BPRODUCTIVE_NODE") {
        let pb = PathBuf::from(&p);
        if pb.is_file() {
            return Some(pb);
        }
    }
    if let Some(h) = home() {
        // Common nvm/fnm/volta locations are version-specific; rely on the shell
        // probe for those. Check the simple cases first.
        for c in [".bun/bin/node", ".volta/bin/node"] {
            let pb = h.join(c);
            if pb.is_file() {
                return Some(pb);
            }
        }
    }
    for c in ["/opt/homebrew/bin/node", "/usr/local/bin/node", "/usr/bin/node"] {
        let pb = PathBuf::from(c);
        if pb.is_file() {
            return Some(pb);
        }
    }
    if let Ok(out) = std::process::Command::new("/bin/zsh")
        .args(["-lic", "command -v node"])
        .output()
    {
        if out.status.success() {
            let p = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !p.is_empty() && Path::new(&p).is_file() {
                return Some(PathBuf::from(p));
            }
        }
    }
    None
}

/// Write the embedded server bundle to `~/.bproductive/` and return its path.
fn ensure_server() -> Result<PathBuf, String> {
    let dir = bproductive_dir().ok_or("no_home")?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("mkdir_failed: {e}"))?;
    let path = dir.join(SERVER_FILE);
    std::fs::write(&path, SERVER_JS).map_err(|e| format!("write_failed: {e}"))?;
    Ok(path)
}

fn claude_config_path() -> Option<PathBuf> {
    home().map(|h| {
        h.join("Library/Application Support/Claude/claude_desktop_config.json")
    })
}

fn codex_config_path() -> Option<PathBuf> {
    home().map(|h| h.join(".codex/config.toml"))
}

fn claude_has_entry() -> bool {
    claude_config_path()
        .and_then(|p| std::fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok())
        .and_then(|v| {
            v.get("mcpServers")
                .and_then(|m| m.get("bproductive"))
                .map(|_| true)
        })
        .unwrap_or(false)
}

fn codex_has_entry() -> bool {
    codex_config_path()
        .and_then(|p| std::fs::read_to_string(p).ok())
        .map(|s| s.contains("[mcp_servers.bproductive]"))
        .unwrap_or(false)
}

#[tauri::command]
pub async fn mcp_status() -> McpStatus {
    let node = resolve_node();
    let server = server_path().filter(|p| p.is_file());
    McpStatus {
        node_path: node.map(|p| p.to_string_lossy().to_string()),
        server_path: server.map(|p| p.to_string_lossy().to_string()),
        claude_installed: claude_has_entry(),
        codex_installed: codex_has_entry(),
        claude_skill: claude_skill_installed(),
        codex_skill: codex_skill_installed(),
    }
}

/// Install the /bnotion skill into a client. Claude → a SKILL.md skill; Codex →
/// a prompt file (becomes the /bnotion slash command).
#[tauri::command]
pub async fn skill_install(target: String) -> Result<(), String> {
    let path = match target.as_str() {
        "claude" => {
            let p = claude_skill_path().ok_or("no_home")?;
            // Claude skills need YAML frontmatter (name + description).
            let content = format!(
                "---\nname: {SKILL_NAME}\ndescription: Manage the B Productive kanban board — read boards/cards and create or edit tasks via the bproductive MCP tools.\n---\n\n{SKILL_BODY}"
            );
            write_file(&p, &content)?;
            return Ok(());
        }
        "codex" => codex_prompt_path().ok_or("no_home")?,
        _ => return Err("unknown_target".into()),
    };
    // Codex prompt: plain markdown body, no frontmatter.
    write_file(&path, SKILL_BODY)
}

#[tauri::command]
pub async fn skill_uninstall(target: String) -> Result<(), String> {
    let path = match target.as_str() {
        "claude" => claude_skill_path(),
        "codex" => codex_prompt_path(),
        _ => return Err("unknown_target".into()),
    }
    .ok_or("no_home")?;
    let _ = std::fs::remove_file(&path);
    Ok(())
}

fn write_file(path: &Path, content: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("mkdir_failed: {e}"))?;
    }
    std::fs::write(path, content).map_err(|e| format!("write_failed: {e}"))
}

fn install_claude(node: &str, server: &str, convex_url: &str, email: &str) -> Result<(), String> {
    let path = claude_config_path().ok_or("no_home")?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("mkdir_failed: {e}"))?;
    }
    let mut root: serde_json::Value = std::fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_else(|| serde_json::json!({}));

    if !root.is_object() {
        root = serde_json::json!({});
    }
    let obj = root.as_object_mut().unwrap();
    let servers = obj
        .entry("mcpServers")
        .or_insert_with(|| serde_json::json!({}));
    if !servers.is_object() {
        *servers = serde_json::json!({});
    }
    servers.as_object_mut().unwrap().insert(
        "bproductive".to_string(),
        serde_json::json!({
            "command": node,
            "args": [server],
            "env": {
                "BPRODUCTIVE_CONVEX_URL": convex_url,
                "BPRODUCTIVE_EMAIL": email,
            }
        }),
    );

    let pretty = serde_json::to_string_pretty(&root).map_err(|e| format!("json_failed: {e}"))?;
    std::fs::write(&path, pretty).map_err(|e| format!("write_failed: {e}"))?;
    Ok(())
}

fn install_codex(node: &str, server: &str, convex_url: &str, email: &str) -> Result<(), String> {
    let path = codex_config_path().ok_or("no_home")?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("mkdir_failed: {e}"))?;
    }
    let existing = std::fs::read_to_string(&path).unwrap_or_default();
    let mut doc = existing
        .parse::<toml_edit::DocumentMut>()
        .unwrap_or_default();

    // [mcp_servers.bproductive]
    let entry = doc["mcp_servers"]["bproductive"].or_insert(toml_edit::table());
    entry["command"] = toml_edit::value(node);
    let mut args = toml_edit::Array::new();
    args.push(server);
    entry["args"] = toml_edit::value(args);

    let mut env = toml_edit::InlineTable::new();
    env.insert("BPRODUCTIVE_CONVEX_URL", convex_url.into());
    env.insert("BPRODUCTIVE_EMAIL", email.into());
    entry["env"] = toml_edit::value(env);

    std::fs::write(&path, doc.to_string()).map_err(|e| format!("write_failed: {e}"))?;
    Ok(())
}

/// Install the MCP server into the given client ("claude" or "codex").
#[tauri::command]
pub async fn mcp_install(
    target: String,
    convex_url: String,
    email: String,
) -> Result<(), String> {
    let node = resolve_node().ok_or("node_not_found")?;
    let node = node.to_string_lossy().to_string();
    let server = ensure_server()?;
    let server = server.to_string_lossy().to_string();

    match target.as_str() {
        "claude" => install_claude(&node, &server, &convex_url, &email),
        "codex" => install_codex(&node, &server, &convex_url, &email),
        _ => Err("unknown_target".into()),
    }
}

fn uninstall_claude() -> Result<(), String> {
    let path = claude_config_path().ok_or("no_home")?;
    let Ok(s) = std::fs::read_to_string(&path) else {
        return Ok(());
    };
    let Ok(mut root) = serde_json::from_str::<serde_json::Value>(&s) else {
        return Ok(());
    };
    if let Some(servers) = root.get_mut("mcpServers").and_then(|m| m.as_object_mut()) {
        servers.remove("bproductive");
    }
    let pretty = serde_json::to_string_pretty(&root).map_err(|e| format!("json_failed: {e}"))?;
    std::fs::write(&path, pretty).map_err(|e| format!("write_failed: {e}"))?;
    Ok(())
}

fn uninstall_codex() -> Result<(), String> {
    let path = codex_config_path().ok_or("no_home")?;
    let Ok(s) = std::fs::read_to_string(&path) else {
        return Ok(());
    };
    let Ok(mut doc) = s.parse::<toml_edit::DocumentMut>() else {
        return Ok(());
    };
    if let Some(servers) = doc.get_mut("mcp_servers").and_then(|m| m.as_table_mut()) {
        servers.remove("bproductive");
    }
    std::fs::write(&path, doc.to_string()).map_err(|e| format!("write_failed: {e}"))?;
    Ok(())
}

#[tauri::command]
pub async fn mcp_uninstall(target: String) -> Result<(), String> {
    match target.as_str() {
        "claude" => uninstall_claude(),
        "codex" => uninstall_codex(),
        _ => Err("unknown_target".into()),
    }
}

/// Persist the currently-open card so external MCP clients can read it via the
/// `get_active_card` tool. `payload` is the JSON for the card, or `None` to clear.
#[tauri::command]
pub async fn mcp_set_active_card(payload: Option<String>) -> Result<(), String> {
    let dir = bproductive_dir().ok_or("no_home")?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("mkdir_failed: {e}"))?;
    let path = active_card_path().ok_or("no_home")?;
    match payload {
        Some(json) => std::fs::write(&path, json).map_err(|e| format!("write_failed: {e}"))?,
        None => {
            let _ = std::fs::remove_file(&path);
        }
    }
    Ok(())
}
