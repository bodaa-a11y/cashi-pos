import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const tempDir = path.join(process.cwd(), 'CashiInstallPackage');
const setupExe = 'C:\\Users\\DELL\\Downloads\\نظام-الكاشير-المتكامل\\release\\Cashi-Setup-1.0.0.exe';
const dbFile = 'C:\\Users\\DELL\\AppData\\Roaming\\كاشي - نظام الكاشير المتكامل\\db.json';
const zipPath = 'C:\\Users\\DELL\\Downloads\\Cashi_POS_Install_Package.zip';

try {
  // 1. Create temp directory
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempDir, { recursive: true });

  // 2. Copy files
  if (fs.existsSync(setupExe)) {
    fs.copyFileSync(setupExe, path.join(tempDir, 'Cashi-Setup-1.0.0.exe'));
    console.log('✅ Copied installer');
  } else {
    throw new Error(`Installer not found at ${setupExe}`);
  }

  if (fs.existsSync(dbFile)) {
    fs.copyFileSync(dbFile, path.join(tempDir, 'db.json'));
    console.log('✅ Copied database');
  } else {
    throw new Error(`Database not found at ${dbFile}`);
  }

  const scriptFile = path.join(process.cwd(), 'setup_db.ps1');
  if (fs.existsSync(scriptFile)) {
    fs.copyFileSync(scriptFile, path.join(tempDir, 'setup_db.ps1'));
    console.log('✅ Copied setup script');
  } else {
    console.warn('⚠️ setup_db.ps1 not found in current directory');
  }

  const batFile = path.join(process.cwd(), 'setup_db.bat');
  if (fs.existsSync(batFile)) {
    fs.copyFileSync(batFile, path.join(tempDir, 'setup_db.bat'));
    console.log('✅ Copied setup batch script');
  } else {
    console.warn('⚠️ setup_db.bat not found in current directory');
  }

  // 3. Compress using windows tar command (built-in in Windows 10+)
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }
  
  // tar -a -c -f <zipPath> -C <tempDir> *
  execSync(`tar -a -c -f "${zipPath}" -C "${tempDir}" Cashi-Setup-1.0.0.exe db.json setup_db.ps1 setup_db.bat`);
  console.log(`✅ Package successfully compressed to ${zipPath}`);

  // 4. Clean up temp dir
  fs.rmSync(tempDir, { recursive: true, force: true });
} catch (e) {
  console.error('❌ Failed:', e.message);
}
