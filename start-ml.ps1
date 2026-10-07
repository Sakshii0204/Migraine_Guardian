# MigraineGuardian — Start ML Service Only
# Starts the FastAPI ML prediction service on port 8000.
#
# Usage (from project root):
#   powershell -ExecutionPolicy Bypass -File start-ml.ps1
#   OR from ml-service dir:
#   python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

$rootDir = $PSScriptRoot
$mlDir = Join-Path $rootDir "ml-service"

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host " MigraineGuardian ML Service" -ForegroundColor Cyan
Write-Host " Starting FastAPI at http://127.0.0.1:8000" -ForegroundColor White
Write-Host "=======================================================" -ForegroundColor Cyan

Set-Location $mlDir
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
