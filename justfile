set shell := ["bash", "-uc"]
# Auto-load a gitignored .env (updater signing key etc.) if present.
set dotenv-load := true

# GitHub repo hosting releases + the updater latest.json.
repo := "JBurdik/b-kanban"
# Keychain profile used by notarytool (reused from the shared Apple account).
profile := "BURROW_NOTARY"

# List recipes
default:
    @just --list

# Dev: Convex backend + Vite frontend
dev:
    pnpm dev

# Dev desktop (Tauri)
desktop:
    pnpm dev:desktop

# Build web (tsc + vite)
build:
    pnpm build

# Build desktop bundle locally (signs + notarizes if Apple env vars set)
build-desktop:
    pnpm build:desktop

# Bump version only (no commit/tag). level = patch | minor | major | X.Y.Z
bump level="patch":
    @node scripts/bump-version.mjs {{level}}
    @cargo update --manifest-path src-tauri/Cargo.toml -p bproductive --quiet
    @echo "Bumped to $(node -p "require('./src-tauri/tauri.conf.json').version")"

# Sync remote self-hosted Convex -> local (data + file storage).
# Needs remote-env (default .env.remote) with CONVEX_SELF_HOSTED_URL + CONVEX_SELF_HOSTED_ADMIN_KEY.
# WARNING: --replace-all wipes the local deployment first.
sync-remote remote-env=".env.remote":
    #!/usr/bin/env bash
    set -euo pipefail
    if [ ! -f "{{remote-env}}" ]; then
        echo "Missing {{remote-env}} (CONVEX_SELF_HOSTED_URL + CONVEX_SELF_HOSTED_ADMIN_KEY for remote)." >&2
        exit 1
    fi
    mkdir -p backups
    zip="backups/prod-snapshot-$(date +%Y-%m-%d).zip"
    echo "Exporting from remote (incl. file storage) -> ${zip}..."
    npx convex export --env-file "{{remote-env}}" --include-file-storage --path "${zip}"
    echo "Importing into local (.env.local), replacing all data..."
    npx convex import --env-file .env.local --replace-all -y "${zip}"
    echo "Sync complete. Backup kept at ${zip}."

# Release: bump → tag/push (Windows builds in GitHub Actions) → build + notarize
# the macOS app locally → merge it into the release + updater latest.json.
# level = patch | minor | major | X.Y.Z   (e.g. `just release minor`)
#
# Requires:
#   - gh CLI logged in
#   - updater signing key at ~/.tauri/bproductive.key (no password — matches the
#     pubkey in tauri.conf.json and the GH Actions secret)
#   - notarytool keychain profile "{{profile}}" set up (xcrun notarytool
#     store-credentials), and Apple codesign identity in tauri.conf.json.
release level="patch":
    #!/usr/bin/env bash
    set -euo pipefail
    command -v gh >/dev/null || { echo "❌ gh CLI not found (brew install gh)"; exit 1; }
    [ -f ~/.tauri/bproductive.key ] || { echo "❌ updater key missing at ~/.tauri/bproductive.key"; exit 1; }
    [ -z "$(git status --porcelain)" ] || { echo "❌ working tree dirty — commit or stash first"; exit 1; }

    git checkout main
    git pull --ff-only
    NEW="$(node scripts/bump-version.mjs {{level}})"
    TAG="v${NEW}"
    cargo update --manifest-path src-tauri/Cargo.toml -p bproductive --quiet
    git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock
    git commit -m "chore: release ${TAG}"
    git tag "${TAG}"
    git push origin main
    git push origin "${TAG}"
    echo "▶ ${TAG} pushed — Windows build running in GitHub Actions."

    echo "▶ Building + signing macOS (arm64) locally…"
    # beforeBuildCommand runs build:mcp + vite; codesign via tauri.conf identity;
    # updater artifacts signed with the local key (no password).
    TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/bproductive.key)" \
    TAURI_SIGNING_PRIVATE_KEY_PASSWORD="" \
        pnpm tauri build

    DMG="src-tauri/target/release/bundle/dmg/B Productive_${NEW}_aarch64.dmg"
    [ -f "$DMG" ] || { echo "❌ dmg not found: $DMG"; exit 1; }
    echo "▶ Notarizing + stapling the dmg…"
    xcrun notarytool submit "$DMG" --keychain-profile "{{profile}}" --wait
    xcrun stapler staple "$DMG"

    echo "▶ Waiting for the Windows CI build (so latest.json merges cleanly)…"
    sleep 15
    RID="$(gh run list --workflow=release.yml -L 1 --json databaseId -q '.[0].databaseId')"
    gh run watch "$RID" --exit-status || echo "⚠ Windows run failed/not found — continuing; verify it manually."

    echo "▶ Publishing macOS assets + merging updater manifest…"
    node scripts/release-mac.mjs "${TAG}"
    echo "✅ ${TAG} ready. Publish the draft release on GitHub: https://github.com/{{repo}}/releases"
