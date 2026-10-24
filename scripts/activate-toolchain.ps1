$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$nodeRoot = Join-Path $repoRoot ".tools\node-v24.22.1-win-x64"
$pnpmExecutable = Join-Path $repoRoot ".tools\pnpm\node_modules\pnpm\pnpm.exe"

if (-not (Test-Path -LiteralPath (Join-Path $nodeRoot "node.exe"))) {
  throw "Node.js 24.22.1 is not installed in .tools. Follow docs/development.md."
}

if (-not (Test-Path -LiteralPath $pnpmExecutable)) {
  throw "pnpm 12.15.0 is not installed in .tools. Follow docs/development.md."
}

$env:LEADFLOW_ROOT = $repoRoot
$env:LEADFLOW_PNPM_EXE = $pnpmExecutable
$env:PATH = "$nodeRoot;$env:PATH"

function global:pnpm {
  & $env:LEADFLOW_PNPM_EXE --dir $env:LEADFLOW_ROOT @args
}

Write-Output "LeadFlow toolchain active for this PowerShell session."
Write-Output "Node $(node --version); pnpm $(pnpm --version)"
