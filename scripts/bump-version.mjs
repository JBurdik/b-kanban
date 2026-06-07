#!/usr/bin/env node
// Bump the desktop app version across package.json, src-tauri/tauri.conf.json
// and src-tauri/Cargo.toml. Source of truth: tauri.conf.json.
//
// Usage: node scripts/bump-version.mjs <patch|minor|major|X.Y.Z>
// Prints the new version to stdout (nothing else), so callers can capture it.

import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("..", import.meta.url);
const p = (rel) => new URL(rel, root);

const TAURI_CONF = p("src-tauri/tauri.conf.json");
const PACKAGE_JSON = p("package.json");
const CARGO_TOML = p("src-tauri/Cargo.toml");

const arg = process.argv[2] ?? "patch";

const conf = JSON.parse(readFileSync(TAURI_CONF, "utf8"));
const current = conf.version;

const semver = /^\d+\.\d+\.\d+$/;
let next;
if (semver.test(arg)) {
  next = arg;
} else {
  const [major, minor, patch] = current.split(".").map(Number);
  if (arg === "major") next = `${major + 1}.0.0`;
  else if (arg === "minor") next = `${major}.${minor + 1}.0`;
  else if (arg === "patch") next = `${major}.${minor}.${patch + 1}`;
  else {
    console.error(`Invalid bump arg: ${arg} (use patch|minor|major|X.Y.Z)`);
    process.exit(1);
  }
}

// tauri.conf.json
conf.version = next;
writeFileSync(TAURI_CONF, JSON.stringify(conf, null, 2) + "\n");

// package.json (preserve formatting via targeted replace on the top-level field)
const pkgRaw = readFileSync(PACKAGE_JSON, "utf8");
writeFileSync(
  PACKAGE_JSON,
  pkgRaw.replace(/("version":\s*")[^"]+(")/, `$1${next}$2`),
);

// Cargo.toml (only the [package] version — the first `version = "..."`)
const cargoRaw = readFileSync(CARGO_TOML, "utf8");
writeFileSync(
  CARGO_TOML,
  cargoRaw.replace(/^version = "[^"]+"/m, `version = "${next}"`),
);

process.stdout.write(next);
