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

# Release: bump version, commit, tag and push -> triggers GitHub release workflow.
# level = patch | minor | major | X.Y.Z   (e.g. `just release minor`)
release level="patch":
    #!/usr/bin/env bash
    set -euo pipefail
    if [ -n "$(git status --porcelain)" ]; then
        echo "Working tree dirty — commit or stash first." >&2
        exit 1
    fi
    git checkout main
    git pull --ff-only
    new="$(node scripts/bump-version.mjs {{level}})"
    cargo update --manifest-path src-tauri/Cargo.toml -p bproductive --quiet
    git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock
    git commit -m "chore: release v${new}"
    git tag "v${new}"
    git push origin main
    git push origin "v${new}"
    echo "Released v${new} — GitHub workflow building macOS + Windows."
