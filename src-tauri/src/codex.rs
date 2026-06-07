//! Codex CLI integration.
//!
//! Spawns the OpenAI `codex` binary (authenticated via the user's ChatGPT
//! subscription, i.e. `~/.codex/auth.json`) and streams its JSONL events back to
//! the webview. The frontend drives all Convex writes; this module is just a
//! process spawner + streamer.
//!
//! We use blocking `std::process` on `spawn_blocking` threads rather than
//! `tokio::process`, because the child-process I/O driver isn't reliably wired
//! into Tauri's async runtime (symptom: stdout never yields → turn hangs).

use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use serde::Serialize;
use tauri::ipc::Channel;
use tauri::Emitter;

/// Result of `codex_check` — what the onboarding UI gates on.
#[derive(Serialize)]
pub struct CodexStatus {
    installed: bool,
    authed: bool,
    version: Option<String>,
    path: Option<String>,
}

/// Streaming event forwarded to the webview over a `Channel`.
#[derive(Clone, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum CodexEvent {
    Started { session_id: String },
    /// A completed `agent_message` item (codex `--json` has no token deltas;
    /// the full assistant message arrives in one event).
    Message { text: String },
    Final { text: String, session_id: String },
    Error { message: String },
}

/// Final return value of `codex_send`.
#[derive(Serialize)]
pub struct CodexResult {
    session_id: Option<String>,
    final_text: String,
}

/// Resolve the absolute path to the `codex` binary.
///
/// GUI-launched macOS apps (a bundled `.app` opened from Finder) do NOT inherit
/// the user's shell PATH, so a bare `Command::new("codex")` fails even though it
/// works under `tauri dev`. We probe known install locations and, as a last
/// resort, ask the login shell to resolve it.
fn resolve_codex_path() -> Option<PathBuf> {
    if let Ok(p) = std::env::var("CODEX_BIN") {
        let pb = PathBuf::from(&p);
        if pb.is_file() {
            return Some(pb);
        }
    }

    if cfg!(windows) {
        // npm global on Windows installs codex.cmd (+ codex.exe shim).
        if let Ok(appdata) = std::env::var("APPDATA") {
            for n in ["npm\\codex.cmd", "npm\\codex.exe"] {
                let p = PathBuf::from(&appdata).join(n);
                if p.is_file() {
                    return Some(p);
                }
            }
        }
        // Windows GUI apps inherit the user PATH — let `where` resolve it.
        if let Ok(out) = Command::new("cmd").args(["/C", "where", "codex"]).output() {
            if out.status.success() {
                if let Some(line) = String::from_utf8_lossy(&out.stdout).lines().next() {
                    let l = line.trim();
                    if !l.is_empty() && Path::new(l).is_file() {
                        return Some(PathBuf::from(l));
                    }
                }
            }
        }
        return None;
    }

    // Unix: GUI apps don't inherit shell PATH, so probe known dirs + login shell.
    if let Some(home) = dirs::home_dir() {
        let candidates = [
            home.join(".cargo/bin/codex"),
            home.join(".npm-global/bin/codex"),
            home.join(".local/bin/codex"),
            home.join(".bun/bin/codex"),
        ];
        for c in candidates {
            if c.is_file() {
                return Some(c);
            }
        }
    }
    for c in [
        "/opt/homebrew/bin/codex",
        "/usr/local/bin/codex",
        "/usr/bin/codex",
    ] {
        let pb = PathBuf::from(c);
        if pb.is_file() {
            return Some(pb);
        }
    }
    if let Ok(out) = Command::new("/bin/zsh")
        .args(["-lic", "command -v codex"])
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

/// Build a Command that runs the codex binary with `args`, handling Windows
/// `.cmd`/`.bat` shims (which must be launched via cmd.exe).
fn codex_cmd(bin: &Path, args: &[&str]) -> Command {
    if cfg!(windows) {
        let ext = bin
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();
        if matches!(ext.as_str(), "cmd" | "bat" | "ps1" | "") {
            let mut c = Command::new("cmd");
            c.arg("/C").arg(bin).args(args);
            return c;
        }
    }
    let mut c = Command::new(bin);
    c.args(args);
    c
}

fn auth_json_path() -> Option<PathBuf> {
    if let Ok(home) = std::env::var("CODEX_HOME") {
        return Some(PathBuf::from(home).join("auth.json"));
    }
    dirs::home_dir().map(|h| h.join(".codex/auth.json"))
}

fn is_authed() -> bool {
    auth_json_path()
        .and_then(|p| std::fs::metadata(&p).ok())
        .map(|m| m.is_file() && m.len() > 0)
        .unwrap_or(false)
}

#[tauri::command]
pub async fn codex_check() -> CodexStatus {
    tauri::async_runtime::spawn_blocking(|| {
        let path = resolve_codex_path();
        let version = path.as_ref().and_then(|p| {
            codex_cmd(p, &["--version"])
                .output()
                .ok()
                .filter(|o| o.status.success())
                .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        });
        CodexStatus {
            installed: path.is_some(),
            authed: is_authed(),
            version,
            path: path.map(|p| p.to_string_lossy().to_string()),
        }
    })
    .await
    .unwrap_or(CodexStatus {
        installed: false,
        authed: false,
        version: None,
        path: None,
    })
}

/// Run `codex login` (opens a browser for the ChatGPT OAuth flow and writes
/// `~/.codex/auth.json`). Progress lines are emitted to the webview via the
/// `codex://login-log` event.
#[tauri::command]
pub async fn codex_login(app: tauri::AppHandle) -> Result<(), String> {
    let bin = resolve_codex_path().ok_or("codex_not_installed")?;

    tauri::async_runtime::spawn_blocking(move || -> Result<(), String> {
        let mut child = codex_cmd(&bin, &["login"])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("codex_spawn_failed: {e}"))?;

        if let Some(stdout) = child.stdout.take() {
            let app = app.clone();
            std::thread::spawn(move || {
                for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                    let _ = app.emit("codex://login-log", line);
                }
            });
        }
        if let Some(stderr) = child.stderr.take() {
            let app = app.clone();
            std::thread::spawn(move || {
                for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                    let _ = app.emit("codex://login-log", line);
                }
            });
        }

        let status = child.wait().map_err(|e| format!("codex_login_failed: {e}"))?;
        if status.success() {
            Ok(())
        } else {
            Err("codex_login_failed".into())
        }
    })
    .await
    .map_err(|e| format!("codex_login_join_failed: {e}"))?
}

/// Send one chat turn. Spawns `codex exec [resume <id>] --json ...`, streams
/// events over `on_event`, and returns the session id + accumulated final text.
#[tauri::command]
pub async fn codex_send(
    prompt: String,
    session_id: Option<String>,
    on_event: Channel<CodexEvent>,
) -> Result<CodexResult, String> {
    let bin = resolve_codex_path().ok_or("codex_not_installed")?;
    if !is_authed() {
        return Err("codex_not_authed".into());
    }

    tauri::async_runtime::spawn_blocking(move || -> Result<CodexResult, String> {
        let mut args: Vec<&str> = vec!["exec"];
        if let Some(ref id) = session_id {
            args.push("resume");
            args.push(id);
        }
        args.extend([
            "--json",
            "--skip-git-repo-check",
            "--sandbox",
            "read-only",
            "--color",
            "never",
            "-", // read prompt from stdin
        ]);
        let mut cmd = codex_cmd(&bin, &args);
        cmd.stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let mut child = cmd.spawn().map_err(|e| format!("codex_spawn_failed: {e}"))?;

        // Write the prompt to stdin, then close it.
        if let Some(mut stdin) = child.stdin.take() {
            stdin
                .write_all(prompt.as_bytes())
                .map_err(|e| format!("codex_stdin_failed: {e}"))?;
            // dropping stdin (end of block) closes it
        }

        // Drain stderr on a side thread for error reporting.
        let stderr_handle = child.stderr.take().map(|stderr| {
            std::thread::spawn(move || {
                let mut buf = String::new();
                for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                    buf.push_str(&line);
                    buf.push('\n');
                }
                buf
            })
        });

        let mut final_text = String::new();
        let mut captured_session = session_id.clone();

        if let Some(stdout) = child.stdout.take() {
            for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    continue;
                }
                match serde_json::from_str::<serde_json::Value>(trimmed) {
                    Ok(v) => {
                        let ty = v.get("type").and_then(|t| t.as_str()).unwrap_or("");
                        match ty {
                            "thread.started" => {
                                if let Some(id) = v.get("thread_id").and_then(|i| i.as_str()) {
                                    captured_session = Some(id.to_string());
                                    let _ = on_event.send(CodexEvent::Started {
                                        session_id: id.to_string(),
                                    });
                                }
                            }
                            "item.completed" => {
                                let item = v.get("item");
                                let item_ty = item
                                    .and_then(|i| i.get("type"))
                                    .and_then(|t| t.as_str())
                                    .unwrap_or("");
                                if item_ty == "agent_message" {
                                    if let Some(text) =
                                        item.and_then(|i| i.get("text")).and_then(|t| t.as_str())
                                    {
                                        if !final_text.is_empty() {
                                            final_text.push_str("\n\n");
                                        }
                                        final_text.push_str(text);
                                        let _ = on_event.send(CodexEvent::Message {
                                            text: text.to_string(),
                                        });
                                    }
                                }
                            }
                            "error" => {
                                let msg = v
                                    .get("message")
                                    .and_then(|m| m.as_str())
                                    .unwrap_or("unknown error")
                                    .to_string();
                                let _ = on_event.send(CodexEvent::Error { message: msg });
                            }
                            _ => {}
                        }
                    }
                    Err(_) => {
                        if !final_text.is_empty() {
                            final_text.push('\n');
                        }
                        final_text.push_str(trimmed);
                    }
                }
            }
        }

        let status = child.wait().map_err(|e| format!("codex_wait_failed: {e}"))?;

        if !status.success() {
            let stderr = stderr_handle
                .and_then(|h| h.join().ok())
                .unwrap_or_default();
            let msg = format!("codex_exec_failed: {}", stderr.trim());
            let _ = on_event.send(CodexEvent::Error { message: msg.clone() });
            return Err(msg);
        }

        let _ = on_event.send(CodexEvent::Final {
            text: final_text.clone(),
            session_id: captured_session.clone().unwrap_or_default(),
        });

        Ok(CodexResult {
            session_id: captured_session,
            final_text,
        })
    })
    .await
    .map_err(|e| format!("codex_join_failed: {e}"))?
}
