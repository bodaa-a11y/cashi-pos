# Cashi POS - Database Setup Script
# Bypasses execution policy and configures database directory safely.

Write-Host "--------------------------------------------------" -ForegroundColor Cyan
Write-Host "   Cashi POS - Database Setup Utility             " -ForegroundColor Cyan
Write-Host "--------------------------------------------------" -ForegroundColor Cyan

# 1. Stop cashier app processes
Write-Host "1. Closing Cashi application..." -ForegroundColor Yellow
Stop-Process -Name "كاشي" -Force -ErrorAction SilentlyContinue
Stop-Process -Name "cashi" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# 2. Determine target path using Unicode characters to avoid encoding corruption on Windows
$FolderName = [char]0x0643 + [char]0x0627 + [char]0x0634 + [char]0x064a + [char]0x0020 + [char]0x002d + [char]0x0020 + [char]0x0646 + [char]0x0638 + [char]0x0627 + [char]0x0645 + [char]0x0020 + [char]0x0627 + [char]0x0644 + [char]0x0643 + [char]0x0627 + [char]0x0634 + [char]0x064a + [char]0x0631 + [char]0x0020 + [char]0x0627 + [char]0x0644 + [char]0x0645 + [char]0x062a + [char]0x0643 + [char]0x0627 + [char]0x0645 + [char]0x0644
$TargetDir = "$env:APPDATA\$FolderName"

# 3. Create folder if not exists
if (!(Test-Path $TargetDir)) {
    Write-Host "2. Creating application folder..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
    Write-Host "   Folder created successfully." -ForegroundColor Green
} else {
    Write-Host "2. Application folder already exists." -ForegroundColor Green
}

# 4. Copy db.json
$SourceFile = "db.json"
if (Test-Path $SourceFile) {
    Write-Host "3. Copying db.json to target directory..." -ForegroundColor Yellow
    Copy-Item -Path $SourceFile -Destination "$TargetDir\db.json" -Force
    Write-Host "✅ Database configured successfully!" -ForegroundColor Green
} else {
    Write-Host "❌ Error: db.json not found in the current folder." -ForegroundColor Red
    Write-Host "   Please ensure this script is run in the same directory as db.json." -ForegroundColor Yellow
}

Write-Host "--------------------------------------------------" -ForegroundColor Cyan
Write-Host "Done! You can now start Cashi POS application." -ForegroundColor Green
Write-Host "--------------------------------------------------" -ForegroundColor Cyan
