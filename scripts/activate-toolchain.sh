#!/usr/bin/env bash

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This activation script supports macOS. Use activate-toolchain.ps1 on Windows." >&2
  return 1 2>/dev/null || exit 1
fi

script_source="${BASH_SOURCE:-$0}"
script_dir="$(cd "$(dirname "$script_source")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"
metadata_path="$repo_root/toolchain.phase1.json"
case "$(uname -m)" in
  arm64) platform_key="arm64" ;;
  x86_64) platform_key="x64" ;;
  *) echo "Unsupported macOS architecture: $(uname -m)" >&2; return 1 2>/dev/null || exit 1 ;;
esac

meta() { /usr/bin/plutil -extract "$1" raw -o - "$metadata_path"; }

node_root="$repo_root/.tools/$(meta "macos.$platform_key.node.installDirectory")"
pnpm_executable="$repo_root/.tools/$(meta pnpm.installDirectory)/bin/pnpm"
java_root="$repo_root/.tools/java/$(meta "macos.$platform_key.java.installDirectory")"
structurizr_executable="$repo_root/.tools/$(meta structurizr.installDirectory)/structurizr.sh"
firebase_emulators_path="$repo_root/.tools/firebase/emulators"
firestore_emulator="$firebase_emulators_path/$(meta firebase.emulatorFile)"

for candidate in "$node_root/bin/node" "$pnpm_executable" "$java_root/bin/java" "$structurizr_executable" "$firestore_emulator"; do
  [[ -e "$candidate" ]] || { echo "Missing project tool $candidate. Run ./scripts/bootstrap-phase1-tools.sh." >&2; return 1 2>/dev/null || exit 1; }
done

export LEADFLOW_ROOT="$repo_root"
export LEADFLOW_PNPM_EXE="$pnpm_executable"
export JAVA_HOME="$java_root"
export LEADFLOW_STRUCTURIZR_CLI="$structurizr_executable"
export FIREBASE_EMULATORS_PATH="$firebase_emulators_path"
export PATH="$java_root/bin:$node_root/bin:$PATH"

pnpm() {
  command "$LEADFLOW_PNPM_EXE" --dir "$LEADFLOW_ROOT" "$@"
}

echo "LeadFlow toolchain active for this shell."
echo "Node $(node --version); pnpm $(pnpm --version)"
echo "Java $(meta java.version); Firestore Emulator $(meta firebase.emulatorVersion); Structurizr CLI $(meta structurizr.version)"
