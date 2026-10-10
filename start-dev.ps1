# MigraineGuardian - Development Startup Script
# Starts: FastAPI ML Service (port 8000) + Express Backend (port 5001) + React Frontend (port 3000)
#
# Usage (from project root):
#   powershell -ExecutionPolicy Bypass -File start-dev.ps1

$ErrorActionPreference = "Stop"
$rootDir = $PSScriptRoot

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host " MigraineGuardian - Full Stack Dev Startup" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan

# -- Helper: check if a TCP port is already in use --------------------------
function Test-Port {
    param([int]$Port)
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $tcp.Connect("127.0.0.1", $Port)
        $tcp.Close()
        return $true
    } catch {
        return $false
    }
}

# -- Helper: wait for ML service health endpoint to return model_loaded=true -
function Wait-ForMLService {
    param(
        [int]$MaxWaitSeconds = 60,
        [string]$HealthUrl = "http://127.0.0.1:8000/health"
    )
    Write-Host "  -> Waiting for ML service to be ready (up to ${MaxWaitSeconds}s)..." -ForegroundColor DarkYellow
    $elapsed = 0
    $interval = 2
    while ($elapsed -lt $MaxWaitSeconds) {
        Start-Sleep -Seconds $interval
        $elapsed += $interval
        try {
            $resp = Invoke-RestMethod -Uri $HealthUrl -TimeoutSec 3 -ErrorAction Stop
            if ($resp.model_loaded -eq $true) {
                Write-Host "  [+] ML service ready - model loaded (${elapsed}s)" -ForegroundColor Green
                return $true
            } elseif ($resp.status -eq "degraded") {
                Write-Host "  [-] ML service running but model FAILED to load: $($resp.model_load_error)" -ForegroundColor Red
                Write-Host "    -> Check ml-service logs. Predictions will not work." -ForegroundColor Red
                return $false
            }
        } catch {
            Write-Host "  ... Waiting... (${elapsed}s)" -ForegroundColor DarkGray
        }
    }
    Write-Host "  [-] ML service did not become ready within ${MaxWaitSeconds}s" -ForegroundColor Red
    return $false
}

# -- 1. FastAPI ML Service (port 8000) --------------------------------------
Write-Host ""
Write-Host "[1/3] FastAPI ML Service (port 8000)..." -ForegroundColor Yellow

if (Test-Port 8000) {
    Write-Host "  [+] Port 8000 already in use - ML service is running. Skipping launch." -ForegroundColor Green
    try {
        $h = Invoke-RestMethod -Uri "http://127.0.0.1:8000/health" -TimeoutSec 5
        if ($h.model_loaded) {
            Write-Host "  [+] ML model confirmed loaded." -ForegroundColor Green
        } else {
            Write-Host "  [!] ML service is up but model is NOT loaded: $($h.model_load_error)" -ForegroundColor Red
        }
    } catch {
        Write-Host "  [!] Could not reach ML health endpoint." -ForegroundColor Red
    }
} else {
    $mlDir = Join-Path $rootDir "ml-service"
    Write-Host "  -> Starting FastAPI at http://127.0.0.1:8000" -ForegroundColor White
    Start-Process powershell -ArgumentList @(
        "-NoExit",
        "-Command",
        "Set-Location '$mlDir'; if (Test-Path '.\.venv\Scripts\Activate.ps1') { & '.\.venv\Scripts\Activate.ps1' }; Write-Host '[ML Service] Starting FastAPI...' -ForegroundColor Cyan; python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"
    ) -WindowStyle Normal
    Write-Host "  [+] ML service window launched." -ForegroundColor Green

    $mlReady = Wait-ForMLService -MaxWaitSeconds 60
    if (-not $mlReady) {
        Write-Host ""
        Write-Host "  WARNING: Proceeding despite ML service not ready." -ForegroundColor DarkYellow
        Write-Host "  Risk predictions may fail on first page load." -ForegroundColor DarkYellow
    }
}

# -- 2. Express Backend (port 5001) -----------------------------------------
Write-Host ""
Write-Host "[2/3] Express Backend (port 5001)..." -ForegroundColor Yellow

if (Test-Port 5001) {
    Write-Host "  [+] Port 5001 already in use - backend is running. Skipping." -ForegroundColor Green
} else {
    $backendDir = Join-Path $rootDir "backend"
    Write-Host "  -> Starting Express backend at http://localhost:5001" -ForegroundColor White
    Start-Process powershell -ArgumentList @(
        "-NoExit",
        "-Command",
        "Set-Location '$backendDir'; Write-Host '[Backend] Starting Express...' -ForegroundColor Yellow; npm start"
    ) -WindowStyle Normal
    Write-Host "  [+] Backend window launched." -ForegroundColor Green
    Start-Sleep -Seconds 3
}

# -- 3. React Frontend (port 3000) ------------------------------------------
Write-Host ""
Write-Host "[3/3] React Frontend (port 3000)..." -ForegroundColor Yellow

if (Test-Port 3000) {
    Write-Host "  [+] Port 3000 already in use - frontend is running. Skipping." -ForegroundColor Green
} else {
    $frontendDir = Join-Path $rootDir "frontend"
    Write-Host "  -> Starting React frontend at http://localhost:3000" -ForegroundColor White
    Start-Process powershell -ArgumentList @(
        "-NoExit",
        "-Command",
        "Set-Location '$frontendDir'; Write-Host '[Frontend] Starting React dev server...' -ForegroundColor Magenta; npm run dev"
    ) -WindowStyle Normal
    Write-Host "  [+] Frontend window launched." -ForegroundColor Green
}

Write-Host ""
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host " All services launched." -ForegroundColor Green
Write-Host ""
Write-Host "  ML Service   -> http://127.0.0.1:8000          (FastAPI / SHAP)" -ForegroundColor White
Write-Host "  ML Health    -> http://127.0.0.1:8000/health" -ForegroundColor White
Write-Host "  ML Predict   -> POST http://127.0.0.1:8000/predict" -ForegroundColor White
Write-Host "  Backend      -> http://localhost:5001           (Express API gateway)" -ForegroundColor White
Write-Host "  Frontend     -> http://localhost:3000           (React / Vite)" -ForegroundColor White
Write-Host "  RAG Chatbot  -> http://localhost:5000/api/chat  (separate process)" -ForegroundColor White
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  The ML service is started FIRST and the backend waits for it." -ForegroundColor DarkGreen
Write-Host "  If Risk Analysis shows service unavailable, check the ML terminal window." -ForegroundColor DarkYellow
Write-Host ""
