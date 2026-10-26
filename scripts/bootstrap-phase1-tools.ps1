param(
  [switch]$Offline
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$metadataPath = Join-Path $repoRoot "toolchain.phase1.json"
$metadata = Get-Content -Raw -LiteralPath $metadataPath | ConvertFrom-Json
$downloadsRoot = Join-Path $repoRoot ".tools\downloads"

New-Item -ItemType Directory -Force -Path $downloadsRoot | Out-Null

function Assert-Checksum {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Expected
  )

  $sha256 = [System.Security.Cryptography.SHA256]::Create()
  $stream = [System.IO.File]::OpenRead($Path)
  try {
    $bytes = $sha256.ComputeHash($stream)
    $actual = ([System.BitConverter]::ToString($bytes) -replace '-', '').ToLowerInvariant()
  }
  finally {
    $stream.Dispose()
    $sha256.Dispose()
  }
  if ($actual -ne $Expected.ToLowerInvariant()) {
    throw "Checksum mismatch for $Path. Expected $Expected; received $actual."
  }
}

function Save-RemoteArtifact {
  param(
    [Parameter(Mandatory = $true)][string]$Url,
    [Parameter(Mandatory = $true)][string]$Destination
  )

  $partial = "$Destination.partial"
  if (Test-Path -LiteralPath $partial) {
    Remove-Item -LiteralPath $partial
  }
  & curl.exe --fail --location --retry 3 --output $partial $Url
  if ($LASTEXITCODE -ne 0) {
    throw "Download failed for $Url with curl exit code $LASTEXITCODE."
  }
  Move-Item -LiteralPath $partial -Destination $Destination
}

function Get-VerifiedArtifact {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Url,
    [Parameter(Mandatory = $true)][string]$Sha256
  )

  $destination = Join-Path $downloadsRoot $Name
  if (Test-Path -LiteralPath $destination) {
    try {
      Assert-Checksum -Path $destination -Expected $Sha256
      return $destination
    }
    catch {
      if ($Offline) {
        throw
      }
      Write-Host "Discarding invalid cached artifact $Name"
      Remove-Item -LiteralPath $destination
    }
  }
  if ($Offline) {
    throw "Missing cached artifact $Name. Run pnpm tools:bootstrap with network access first."
  }
  if (-not (Test-Path -LiteralPath $destination)) {
    Write-Host "Downloading $Name"
    Save-RemoteArtifact -Url $Url -Destination $destination
  }
  Assert-Checksum -Path $destination -Expected $Sha256
  return $destination
}

$nodeArchive = Get-VerifiedArtifact `
  -Name $metadata.node.archiveName `
  -Url $metadata.node.downloadUrl `
  -Sha256 $metadata.node.sha256
$toolsRoot = Join-Path $repoRoot ".tools"
$nodeRoot = Join-Path $toolsRoot $metadata.node.installDirectory
$nodeExecutable = Join-Path $nodeRoot "node.exe"
if (-not (Test-Path -LiteralPath $nodeExecutable)) {
  if (Test-Path -LiteralPath $nodeRoot) {
    throw "Incomplete Node.js directory at $nodeRoot. Remove only that directory and rerun bootstrap."
  }
  Expand-Archive -LiteralPath $nodeArchive -DestinationPath $toolsRoot
}
if (-not (Test-Path -LiteralPath $nodeExecutable)) {
  throw "Node.js extraction did not create $nodeExecutable."
}
$nodeVersion = & $nodeExecutable --version
if ($nodeVersion -ne "v$($metadata.node.version)") {
  throw "Node.js version mismatch. Expected v$($metadata.node.version); received $nodeVersion."
}

# pnpm ships its Windows binary as a platform-specific optional dependency,
# so it is installed by the verified Node.js's own npm at the exact version;
# npm checks the registry integrity, and a published version is immutable.
$pnpmRoot = Join-Path $toolsRoot $metadata.pnpm.installDirectory
$pnpmExecutable = Join-Path $pnpmRoot "node_modules\pnpm\pnpm.exe"
if (-not (Test-Path -LiteralPath $pnpmExecutable)) {
  if ($Offline) {
    throw "Missing pnpm $($metadata.pnpm.version) in .tools. Run pnpm tools:bootstrap with network access first."
  }
  Write-Output "Installing pnpm $($metadata.pnpm.version)"
  $env:PATH = "$nodeRoot;$env:PATH"
  & (Join-Path $nodeRoot "npm.cmd") install --global --no-fund --no-audit --prefix $pnpmRoot "pnpm@$($metadata.pnpm.version)"
  if ($LASTEXITCODE -ne 0) {
    throw "pnpm installation failed with npm exit code $LASTEXITCODE."
  }
}
$pnpmVersion = & $pnpmExecutable --version
if ($pnpmVersion -ne $metadata.pnpm.version) {
  throw "pnpm version mismatch. Expected $($metadata.pnpm.version); received $pnpmVersion."
}

$javaArchive = Get-VerifiedArtifact `
  -Name $metadata.java.archiveName `
  -Url $metadata.java.downloadUrl `
  -Sha256 $metadata.java.sha256
$javaParent = Join-Path $repoRoot ".tools\java"
$javaRoot = Join-Path $javaParent $metadata.java.installDirectory
$javaExecutable = Join-Path $javaRoot "bin\java.exe"
if (-not (Test-Path -LiteralPath $javaExecutable)) {
  if (Test-Path -LiteralPath $javaRoot) {
    throw "Incomplete Java directory at $javaRoot. Remove only that directory and rerun bootstrap."
  }
  New-Item -ItemType Directory -Force -Path $javaParent | Out-Null
  Expand-Archive -LiteralPath $javaArchive -DestinationPath $javaParent
}
if (-not (Test-Path -LiteralPath $javaExecutable)) {
  throw "Java extraction did not create $javaExecutable."
}

$structurizrArchive = Get-VerifiedArtifact `
  -Name $metadata.structurizr.archiveName `
  -Url $metadata.structurizr.downloadUrl `
  -Sha256 $metadata.structurizr.sha256
$structurizrRoot = Join-Path $repoRoot ".tools\$($metadata.structurizr.installDirectory)"
$structurizrExecutable = Join-Path $structurizrRoot "structurizr.bat"
if (-not (Test-Path -LiteralPath $structurizrExecutable)) {
  if (Test-Path -LiteralPath $structurizrRoot) {
    throw "Incomplete Structurizr directory at $structurizrRoot. Remove only that directory and rerun bootstrap."
  }
  New-Item -ItemType Directory -Force -Path $structurizrRoot | Out-Null
  Expand-Archive -LiteralPath $structurizrArchive -DestinationPath $structurizrRoot
}
if (-not (Test-Path -LiteralPath $structurizrExecutable)) {
  throw "Structurizr extraction did not create $structurizrExecutable."
}

$firebaseCache = Join-Path $repoRoot ".tools\firebase\emulators"
New-Item -ItemType Directory -Force -Path $firebaseCache | Out-Null
$firebaseArtifact = Join-Path $firebaseCache $metadata.firebase.emulatorFile
if (-not (Test-Path -LiteralPath $firebaseArtifact)) {
  if ($Offline) {
    throw "Missing cached Firestore Emulator $($metadata.firebase.emulatorFile). Run pnpm tools:bootstrap with network access first."
  }
  Write-Output "Downloading $($metadata.firebase.emulatorFile)"
  Save-RemoteArtifact -Url $metadata.firebase.emulatorUrl -Destination $firebaseArtifact
}
Assert-Checksum -Path $firebaseArtifact -Expected $metadata.firebase.emulatorSha256

$javaVersion = & $javaExecutable --version | Select-Object -First 1
if ($javaVersion -notmatch [regex]::Escape($metadata.java.runtimeVersion)) {
  throw "Java version mismatch. Expected $($metadata.java.runtimeVersion); received $javaVersion."
}

Write-Output "Phase 1 tools verified."
Write-Output "Node.js $($metadata.node.version)"
Write-Output "pnpm $($metadata.pnpm.version)"
Write-Output "Java $($metadata.java.version)"
Write-Output "Firestore Emulator $($metadata.firebase.emulatorVersion)"
Write-Output "Structurizr CLI $($metadata.structurizr.version)"
if ($Offline) {
  Write-Output "Offline cache verification passed."
}
