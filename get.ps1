# ZeliCast — one-command bootstrap for Windows PowerShell
# Gets the source from GitHub and starts the app:
#   irm https://raw.githubusercontent.com/hajunho/zeli-cast/master/get.ps1 | iex
$ErrorActionPreference = "Stop"

$repo = "hajunho/zeli-cast"
$dir = Join-Path (Get-Location) "zeli-cast"

if (Test-Path $dir) {
    Write-Host "Folder .\zeliai_cast already exists - using it." -ForegroundColor Yellow
} elseif (Get-Command git -ErrorAction SilentlyContinue) {
    Write-Host "Cloning https://github.com/$repo ..." -ForegroundColor Cyan
    git clone "https://github.com/$repo.git" $dir
} else {
    Write-Host "git not found - downloading ZIP instead..." -ForegroundColor Cyan
    $zip = Join-Path $env:TEMP "zeli-cast.zip"
    Invoke-WebRequest "https://github.com/$repo/archive/refs/heads/master.zip" -OutFile $zip
    Expand-Archive $zip -DestinationPath (Get-Location) -Force
    Rename-Item (Join-Path (Get-Location) "zeli-cast-master") $dir
    Remove-Item $zip
}

Set-Location $dir
Write-Host ""
Write-Host "Tip: shared demo keys are included - all 5 weather sources work instantly." -ForegroundColor Green
Write-Host "     For regular use (and news/stock/places), copy" -ForegroundColor Green
Write-Host "     server\.env.example to server\.env and add your free keys." -ForegroundColor Green
Write-Host ""
powershell -ExecutionPolicy Bypass -File .\run.ps1
