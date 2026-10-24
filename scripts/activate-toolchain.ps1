$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$nodeRoot = Join-Path $repoRoot ".tools\node-v24.22.1-win-x64"
$pnpmExecutable = Join-Path $repoRoot ".tools\pnpm\node_modules\pnpm\pnpm.exe"
$phaseOneMetadata = Get-Content -Raw -LiteralPath (Join-Path $repoRoot "toolchain.phase1.json") | ConvertFrom-Json
$javaRoot = Join-Path $repoRoot ".tools\java\$($phaseOneMetadata.java.installDirectory)"
$javaExecutable = Join-Path $javaRoot "bin\java.exe"
$structurizrExecutable = Join-Path $repoRoot ".tools\$($phaseOneMetadata.structurizr.installDirectory)\structurizr.bat"
$firebaseEmulatorsPath = Join-Path $repoRoot ".tools\firebase\emulators"
$firestoreEmulator = Join-Path $firebaseEmulatorsPath $phaseOneMetadata.firebase.emulatorFile

if (-not (Test-Path -LiteralPath (Join-Path $nodeRoot "node.exe"))) {
  throw "Node.js 24.22.1 is not installed in .tools. Follow docs/development.md."
}

if (-not (Test-Path -LiteralPath $pnpmExecutable)) {
  throw "pnpm 12.15.0 is not installed in .tools. Follow docs/development.md."
}

if (-not (Test-Path -LiteralPath $javaExecutable)) {
  throw "Java $($phaseOneMetadata.java.version) is not installed in .tools. Run the Phase 1 tool bootstrap described in docs/development.md."
}

if (-not (Test-Path -LiteralPath $structurizrExecutable)) {
  throw "Structurizr CLI $($phaseOneMetadata.structurizr.version) is not installed in .tools. Follow docs/development.md."
}

if (-not (Test-Path -LiteralPath $firestoreEmulator)) {
  throw "Firestore Emulator $($phaseOneMetadata.firebase.emulatorVersion) is not cached in .tools. Follow docs/development.md."
}

$env:LEADFLOW_ROOT = $repoRoot
$env:LEADFLOW_PNPM_EXE = $pnpmExecutable
$env:JAVA_HOME = $javaRoot
$env:LEADFLOW_STRUCTURIZR_CLI = $structurizrExecutable
$env:FIREBASE_EMULATORS_PATH = $firebaseEmulatorsPath
$env:PATH = "$javaRoot\bin;$nodeRoot;$env:PATH"

function global:pnpm {
  & $env:LEADFLOW_PNPM_EXE --dir $env:LEADFLOW_ROOT @args
}

Write-Output "LeadFlow toolchain active for this PowerShell session."
Write-Output "Node $(node --version); pnpm $(pnpm --version)"
Write-Output "Java $($phaseOneMetadata.java.version); Firestore Emulator $($phaseOneMetadata.firebase.emulatorVersion); Structurizr CLI $($phaseOneMetadata.structurizr.version)"
