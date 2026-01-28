Write-Host "Starting Secure Messenger normalization..." -ForegroundColor Cyan

# Safety check
if (!(Test-Path "package.json")) {
  Write-Host "Run this script from project root." -ForegroundColor Red
  exit 1
}

# 1. Create Electron boundary
New-Item -ItemType Directory -Force -Path electron | Out-Null
New-Item -ItemType Directory -Force -Path electron\db | Out-Null
New-Item -ItemType Directory -Force -Path electron\ipc | Out-Null
New-Item -ItemType Directory -Force -Path electron\sync | Out-Null
New-Item -ItemType Directory -Force -Path electron\security | Out-Null

# 2. Move backend logic out of public
if (Test-Path "public\db.js") {
  Move-Item public\db.js electron\db\database.js -Force
}
if (Test-Path "public\websocket-server.js") {
  Move-Item public\websocket-server.js electron\sync\websocket-server.js -Force
}
if (Test-Path "public\electron.js") {
  Move-Item public\electron.js electron\main.js -Force
}

# 3. Remove unsafe backend exposure
if (Test-Path "public\security") {
  Remove-Item public\security -Recurse -Force
}

# 4. Normalize src usage (keep Redux + UI only)
if (!(Test-Path "src\store")) {
  New-Item -ItemType Directory -Force -Path src\store | Out-Null
}

# 5. Create preload security bridge
$preload = @"
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  invoke: (channel, payload) => ipcRenderer.invoke(channel, payload),
  on: (channel, callback) =>
    ipcRenderer.on(channel, (_, data) => callback(data))
});
"@

Set-Content -Path electron\preload.js -Value $preload

# 6. Create Electron entry if missing
if (!(Test-Path "electron\main.js")) {
$main = @"
const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  win.loadURL('http://localhost:3000');
}

app.whenReady().then(createWindow);
"@
Set-Content -Path electron\main.js -Value $main
}

Write-Host "Migration completed successfully." -ForegroundColor Green
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. npm run dev (Next.js)" -ForegroundColor Yellow
Write-Host "2. electron . (Electron shell)" -ForegroundColor Yellow
