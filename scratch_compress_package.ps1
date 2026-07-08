$tempDir = "C:\Users\DELL\Downloads\نظام-الكاشير-المتكامل\CashiInstallPackage"
$setupExe = "C:\Users\DELL\Downloads\نظام-الكاشير-المتكامل\release\Cashi-Setup-1.0.0.exe"
$dbFile = "C:\Users\DELL\AppData\Roaming\كاشي - نظام الكاشير المتكامل\db.json"
$zipPath = "C:\Users\DELL\Downloads\Cashi_POS_Install_Package.zip"

try {
    # 1. Create temp dir
    if (Test-Path $tempDir) { Remove-Item -Path $tempDir -Recurse -Force }
    New-Item -ItemType Directory -Path $tempDir | Out-Null
    
    # 2. Copy Setup Exe
    if (Test-Path $setupExe) {
        Copy-Item -Path $setupExe -Destination (Join-Path $tempDir "Cashi-Setup-1.0.0.exe") -Force
        Write-Host "✅ Copied installer."
    } else {
        Write-Error "❌ Installer not found at $setupExe"
        exit 1
    }
    
    # 3. Copy DB json
    if (Test-Path $dbFile) {
        Copy-Item -Path $dbFile -Destination (Join-Path $tempDir "db.json") -Force
        Write-Host "✅ Copied database."
    } else {
        Write-Error "❌ Database not found at $dbFile"
        exit 1
    }
    
    # 4. Zip it
    if (Test-Path $zipPath) { Remove-Item -Path $zipPath -Force }
    Compress-Archive -Path "$tempDir\*" -DestinationPath $zipPath -Force
    Write-Host "✅ Compressed package successfully to $zipPath"
    
    # 5. Clean up temp dir
    Remove-Item -Path $tempDir -Recurse -Force
} catch {
    Write-Error "❌ Failed to compress package: $_"
}
