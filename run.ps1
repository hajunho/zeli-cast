# ZeliCast - one-file launcher for Windows PowerShell
# Usage: powershell -ExecutionPolicy Bypass -File .\run.ps1
$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js is required but was not found." -ForegroundColor Red
    Write-Host "Install the LTS version from https://nodejs.org and run this script again."
    exit 1
}
Write-Host "Node $(node --version) / npm $(npm --version) detected." -ForegroundColor Green

if (-not (Test-Path (Join-Path $PSScriptRoot "node_modules"))) {
    Write-Host "Installing frontend dependencies (first run only)..." -ForegroundColor Cyan
    npm install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { Write-Host "npm install failed." -ForegroundColor Red; exit 1 }
}
if (-not (Test-Path (Join-Path $PSScriptRoot "server\node_modules"))) {
    Write-Host "Installing server dependencies (first run only)..." -ForegroundColor Cyan
    Push-Location server
    npm install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Host "npm install failed." -ForegroundColor Red; exit 1 }
    Pop-Location
}

if (-not (Test-Path (Join-Path $PSScriptRoot "server\.env"))) {
    Write-Host "Tip: no server\.env found - running with the free keyless weather source only." -ForegroundColor Yellow
    Write-Host "     Copy server\.env.example to server\.env and add keys to enable all 5 sources."
}

Write-Host "Starting backend (5171) + frontend (5172)... browser opens in a moment (Ctrl+C to stop)" -ForegroundColor Cyan
Start-Job -ScriptBlock { Start-Sleep -Seconds 4; Start-Process "http://localhost:5172" } | Out-Null
npm run dev
