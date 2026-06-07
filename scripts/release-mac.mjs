#!/usr/bin/env node
// Upload the locally-built macOS artifacts to the GitHub release and merge the
// macOS entry into the updater's latest.json. The Windows entry + the draft
// release itself are produced by the CI workflow (.github/workflows/release.yml);
// this only ADDS macOS, it never drops the Windows platform.
//
// Run via `just release` after `pnpm tauri build` + notarization, e.g.:
//   node scripts/release-mac.mjs v0.4.0

import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tag = process.argv[2];
if (!tag) {
  console.error("usage: node scripts/release-mac.mjs <tag>");
  process.exit(1);
}

const version = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8")).version;

const remote = execFileSync("git", ["remote", "get-url", "origin"], { encoding: "utf8" }).trim();
const repo = remote.match(/github\.com[:/](.+?)(?:\.git)?$/)?.[1];
if (!repo) throw new Error(`can't parse owner/repo from ${remote}`);

const BUNDLE = "src-tauri/target/release/bundle";

function findOne(dir, ext) {
  const f = readdirSync(dir).find((n) => n.endsWith(ext));
  if (!f) throw new Error(`no ${ext} found in ${dir}`);
  return join(dir, f);
}
function gh(args) {
  execFileSync("gh", args, { stdio: "inherit" });
}

const dmg = findOne(join(BUNDLE, "dmg"), ".dmg");
const tarball = findOne(join(BUNDLE, "macos"), ".app.tar.gz");
const sig = readFileSync(`${tarball}.sig`, "utf8").trim();

// Rename the updater tarball to a stable, space-free, versioned name so its URL
// is clean and unique per release.
const work = mkdtempSync(join(tmpdir(), "bprel-"));
const tarName = `B-Productive_${version}_aarch64.app.tar.gz`;
const tarCopy = join(work, tarName);
copyFileSync(tarball, tarCopy);

console.log(`Uploading macOS assets to ${tag} …`);
gh(["release", "upload", tag, dmg, tarCopy, "--clobber"]);

// Merge into latest.json (download the CI/Windows one if present, else start new).
let manifest = { version, pub_date: undefined, platforms: {} };
try {
  execFileSync("gh", ["release", "download", tag, "-p", "latest.json", "-D", work, "--clobber"], {
    stdio: "ignore",
  });
  manifest = JSON.parse(readFileSync(join(work, "latest.json"), "utf8"));
  console.log("merging into existing latest.json (keeps Windows entry)");
} catch {
  console.log("no existing latest.json — creating a new one (macOS only)");
}

manifest.version = version;
manifest.platforms = manifest.platforms ?? {};
manifest.platforms["darwin-aarch64"] = {
  signature: sig,
  url: `https://github.com/${repo}/releases/download/${tag}/${tarName}`,
};

const out = join(work, "latest.json");
writeFileSync(out, JSON.stringify(manifest, null, 2));
gh(["release", "upload", tag, out, "--clobber"]);

console.log(`✓ macOS published for ${tag}. platforms: ${Object.keys(manifest.platforms).join(", ")}`);
