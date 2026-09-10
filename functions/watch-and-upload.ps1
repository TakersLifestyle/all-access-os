# watch-and-upload.ps1
# Watches Downloads/ROCAFIESTA for Lightroom to finish, then runs the upload script.

$FOLDER   = "C:\Users\TakersLifestyle\Downloads\ROCAFIESTA"
$SCRIPT   = "C:\Users\TakersLifestyle\all-access-platform\functions\create-rocafiesta-memories.mjs"
$NODE_DIR = "C:\Users\TakersLifestyle\all-access-platform\functions"

Write-Host ""
Write-Host "👀 Watching for Lightroom to finish..." -ForegroundColor Cyan
Write-Host "   Folder: $FOLDER"
Write-Host "   Polling every 20 seconds. Press Ctrl+C to cancel."
Write-Host ""

$stableCount = 0
$lastFileCount = 0
$lastSize = 0

while ($true) {
    Start-Sleep -Seconds 20

    $files     = Get-ChildItem $FOLDER -File -ErrorAction SilentlyContinue
    $lrtmp     = $files | Where-Object { $_.Name -match "\.LrTmp" }
    $fileCount = ($files | Measure-Object).Count
    $totalSize = ($files | Measure-Object -Property Length -Sum).Sum
    $mp4Count  = ($files | Where-Object { $_.Extension -eq ".mp4" } | Measure-Object).Count
    $jpgCount  = ($files | Where-Object { $_.Extension -match "\.(jpg|jpeg)$" } | Measure-Object).Count
    $sizeMB    = [math]::Round($totalSize / 1MB, 0)

    $timestamp = Get-Date -Format "HH:mm:ss"

    if ($lrtmp) {
        $stableCount = 0
        $lrtmpName = ($lrtmp | Select-Object -First 1).Name
        Write-Host "[$timestamp] 🔄 Still downloading... $mp4Count MP4s · $jpgCount JPGs · ${sizeMB} MB total  ($lrtmpName active)" -ForegroundColor Yellow
    } else {
        # No .LrTmp — check if file count and size are stable
        if ($fileCount -eq $lastFileCount -and $totalSize -eq $lastSize) {
            $stableCount++
            Write-Host "[$timestamp] ✅ No active downloads... stable check $stableCount/3  ($mp4Count MP4s · $jpgCount JPGs · ${sizeMB} MB)" -ForegroundColor Green
        } else {
            $stableCount = 0
            Write-Host "[$timestamp] 🔄 Files still changing... $mp4Count MP4s · $jpgCount JPGs · ${sizeMB} MB" -ForegroundColor Yellow
        }

        if ($stableCount -ge 3) {
            Write-Host ""
            Write-Host "[$timestamp] 🚀 Lightroom done! Starting upload..." -ForegroundColor Cyan
            Write-Host ""
            Set-Location $NODE_DIR
            node create-rocafiesta-memories.mjs
            break
        }
    }

    $lastFileCount = $fileCount
    $lastSize      = $totalSize
}
