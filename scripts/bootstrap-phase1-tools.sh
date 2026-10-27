#!/usr/bin/env bash
set -euo pipefail

offline=false
if [[ "${1:-}" == "--offline" ]]; then
  offline=true
elif [[ $# -gt 0 ]]; then
  echo "Usage: $0 [--offline]" >&2
  exit 2
fi

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This bootstrap supports macOS. Use bootstrap-phase1-tools.ps1 on Windows." >&2
  exit 1
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"
metadata_path="$repo_root/toolchain.phase1.json"
tools_root="$repo_root/.tools"
downloads_root="$tools_root/downloads"
mkdir -p "$downloads_root"

case "$(uname -m)" in
  arm64) platform_key="arm64" ;;
  x86_64) platform_key="x64" ;;
  *) echo "Unsupported macOS architecture: $(uname -m)" >&2; exit 1 ;;
esac

meta() {
  /usr/bin/plutil -extract "$1" raw -o - "$metadata_path"
}

verify_checksum() {
  local file="$1"
  local expected="$2"
  local actual
  actual="$(/usr/bin/shasum -a 256 "$file" | /usr/bin/awk '{print $1}')"
  if [[ "$actual" != "$expected" ]]; then
    echo "Checksum mismatch for $file. Expected $expected; received $actual." >&2
    return 1
  fi
}

verified_artifact() {
  local name="$1"
  local url="$2"
  local expected="$3"
  local destination="$downloads_root/$name"
  if [[ -f "$destination" ]] && verify_checksum "$destination" "$expected"; then
    printf '%s\n' "$destination"
    return
  fi
  if [[ "$offline" == true ]]; then
    echo "Missing or invalid cached artifact $name. Run ./scripts/bootstrap-phase1-tools.sh while connected." >&2
    exit 1
  fi
  rm -f "$destination.partial"
  echo "Downloading $name" >&2
  /usr/bin/curl --fail --location --retry 3 --output "$destination.partial" "$url"
  /bin/mv "$destination.partial" "$destination"
  verify_checksum "$destination" "$expected"
  printf '%s\n' "$destination"
}

node_archive_name="$(meta "macos.$platform_key.node.archiveName")"
node_archive="$(verified_artifact "$node_archive_name" "$(meta "macos.$platform_key.node.downloadUrl")" "$(meta "macos.$platform_key.node.sha256")")"
node_root="$tools_root/$(meta "macos.$platform_key.node.installDirectory")"
if [[ ! -x "$node_root/bin/node" ]]; then
  [[ ! -e "$node_root" ]] || { echo "Incomplete Node.js directory at $node_root. Remove only that directory and rerun bootstrap." >&2; exit 1; }
  /usr/bin/tar -xzf "$node_archive" -C "$tools_root"
fi
[[ "$($node_root/bin/node --version)" == "v$(meta node.version)" ]] || { echo "Node.js version mismatch." >&2; exit 1; }

pnpm_root="$tools_root/$(meta pnpm.installDirectory)"
pnpm_executable="$pnpm_root/bin/pnpm"
if [[ ! -x "$pnpm_executable" ]]; then
  if [[ "$offline" == true ]]; then
    echo "Missing pnpm $(meta pnpm.version). Run ./scripts/bootstrap-phase1-tools.sh while connected." >&2
    exit 1
  fi
  echo "Installing pnpm $(meta pnpm.version)"
  PATH="$node_root/bin:$PATH" "$node_root/bin/npm" install --global --no-fund --no-audit --prefix "$pnpm_root" "pnpm@$(meta pnpm.version)"
fi
PATH="$node_root/bin:$PATH" "$pnpm_executable" --version | /usr/bin/grep -Fx "$(meta pnpm.version)" >/dev/null

java_archive_name="$(meta "macos.$platform_key.java.archiveName")"
java_archive="$(verified_artifact "$java_archive_name" "$(meta "macos.$platform_key.java.downloadUrl")" "$(meta "macos.$platform_key.java.sha256")")"
java_root="$tools_root/java/$(meta "macos.$platform_key.java.installDirectory")"
if [[ ! -x "$java_root/bin/java" ]]; then
  mkdir -p "$tools_root/java"
  /usr/bin/tar -xzf "$java_archive" -C "$tools_root/java"
fi

structurizr_archive="$(verified_artifact "$(meta structurizr.archiveName)" "$(meta structurizr.downloadUrl)" "$(meta structurizr.sha256)")"
structurizr_root="$tools_root/$(meta structurizr.installDirectory)"
if [[ ! -x "$structurizr_root/structurizr.sh" ]]; then
  [[ ! -e "$structurizr_root" ]] || { echo "Incomplete Structurizr directory at $structurizr_root. Remove only that directory and rerun bootstrap." >&2; exit 1; }
  mkdir -p "$structurizr_root"
  /usr/bin/unzip -q "$structurizr_archive" -d "$structurizr_root"
  /bin/chmod +x "$structurizr_root/structurizr.sh"
fi

firebase_root="$tools_root/firebase/emulators"
mkdir -p "$firebase_root"
firebase_file="$(meta firebase.emulatorFile)"
firebase_artifact="$(verified_artifact "$firebase_file" "$(meta firebase.emulatorUrl)" "$(meta firebase.emulatorSha256)")"
/bin/cp "$firebase_artifact" "$firebase_root/$firebase_file"

"$java_root/bin/java" --version 2>&1 | /usr/bin/grep -F "$(meta java.runtimeVersion)" >/dev/null

echo "Phase 1 tools verified for macOS $platform_key."
echo "Node.js $(meta node.version)"
echo "pnpm $(meta pnpm.version)"
echo "Java $(meta java.version)"
echo "Firestore Emulator $(meta firebase.emulatorVersion)"
echo "Structurizr CLI $(meta structurizr.version)"
if [[ "$offline" == true ]]; then echo "Offline cache verification passed."; fi
