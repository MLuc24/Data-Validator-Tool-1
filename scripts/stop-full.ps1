$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$runtime = Join-Path $root ".runtime"

Write-Host "dev:full now runs in the foreground. Press Ctrl+C in that terminal to stop it."

function Stop-FromPidFile {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name
  )

  $pidFile = Join-Path $runtime "$Name.pid"
  if (-not (Test-Path $pidFile)) {
    Write-Host "$Name is not running."
    return
  }

  $rawPid = Get-Content $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $rawPid) {
    Remove-Item $pidFile -ErrorAction SilentlyContinue
    Write-Host "$Name pid file was empty."
    return
  }

  $targetPid = 0
  if (-not [int]::TryParse($rawPid.Trim(), [ref]$targetPid)) {
    Remove-Item $pidFile -ErrorAction SilentlyContinue
    Write-Host "$Name pid file was invalid."
    return
  }

  $process = Get-Process -Id $targetPid -ErrorAction SilentlyContinue
  if ($process) {
    Stop-Process -Id $targetPid -Force
    Write-Host "Stopped $Name (PID $targetPid)."
  } else {
    Write-Host "$Name was not running."
  }

  Remove-Item $pidFile -ErrorAction SilentlyContinue
}

if (-not (Test-Path $runtime)) {
  Write-Host "No .runtime directory found."
  exit 0
}

Stop-FromPidFile -Name "api"
Stop-FromPidFile -Name "ui"
