# publish.ps1
# Script to package and publish collect_files.js to C:\Tools and add to PATH

# Ensure script is run with administrator privileges
If (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Warning "This script requires administrator privileges. Please run as administrator."
    Write-Warning "Right-click the PowerShell icon and select 'Run as administrator'."
    Exit
}

# Configuration
$ToolName = "collect_files"
$ToolsPath = "C:\Tools"
$ExecutablePath = "$ToolsPath\$ToolName.exe"
$ScriptPath = "$PSScriptRoot\$ToolName.js"

# Check if pkg is installed, install if not
$pkgInstalled = npm list -g pkg 2>$null | Select-String -Pattern "pkg@"
if (-not $pkgInstalled) {
    Write-Host "pkg not found. Installing globally..." -ForegroundColor Yellow
    npm install -g pkg
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to install pkg. Please install it manually with 'npm install -g pkg'" -ForegroundColor Red
        Exit 1
    }
    Write-Host "pkg installed successfully." -ForegroundColor Green
} else {
    Write-Host "pkg is already installed." -ForegroundColor Green
}

# Check if source file exists
if (-not (Test-Path $ScriptPath)) {
    Write-Host "Error: $ScriptPath not found!" -ForegroundColor Red
    Write-Host "Make sure this script is in the same directory as $ToolName.js" -ForegroundColor Red
    Exit 1
}

# Create build folder if it doesn't exist
$BuildPath = "$PSScriptRoot\build"
if (-not (Test-Path $BuildPath)) {
    Write-Host "Creating build directory: $BuildPath" -ForegroundColor Cyan
    New-Item -ItemType Directory -Path $BuildPath -Force | Out-Null
}

# Package the JavaScript file using pkg
Write-Host "Packaging $ToolName.js to executable..." -ForegroundColor Cyan
pkg $ScriptPath --target node16-win-x64 --output "$BuildPath\$ToolName.exe"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to package the script." -ForegroundColor Red
    Exit 1
}
Write-Host "Packaging completed successfully." -ForegroundColor Green

# Create C:\Tools directory if it doesn't exist
if (-not (Test-Path $ToolsPath)) {
    Write-Host "Creating directory: $ToolsPath" -ForegroundColor Cyan
    New-Item -ItemType Directory -Path $ToolsPath -Force | Out-Null
}

# Copy executable to C:\Tools
Write-Host "Copying executable to $ExecutablePath" -ForegroundColor Cyan
Copy-Item -Path "$BuildPath\$ToolName.exe" -Destination $ExecutablePath -Force
Write-Host "Executable copied successfully." -ForegroundColor Green

# Check if C:\Tools is in PATH, add if not
$currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
if (-not ($currentPath -split ";" -contains $ToolsPath)) {
    Write-Host "$ToolsPath not found in system PATH. Adding it..." -ForegroundColor Yellow
    [Environment]::SetEnvironmentVariable("Path", "$currentPath;$ToolsPath", "Machine")
    Write-Host "$ToolsPath added to system PATH successfully." -ForegroundColor Green
} else {
    Write-Host "$ToolsPath is already in system PATH." -ForegroundColor Green
}

# Copy config file if exists
$ConfigPath = "$PSScriptRoot\collect-files.config.json"
if (Test-Path $ConfigPath) {
    Write-Host "Found configuration file. Copying to $ToolsPath" -ForegroundColor Cyan
    Copy-Item -Path $ConfigPath -Destination "$ToolsPath\collect-files.config.json" -Force
    Write-Host "Configuration file copied. Note: This will be used only when running from the $ToolsPath directory." -ForegroundColor Yellow
}

# Verify installation
$toolAvailable = $false
try {
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    $null = Get-Command $ToolName -ErrorAction Stop
    $toolAvailable = $true
} catch {
    $toolAvailable = $false
}

if ($toolAvailable) {
    Write-Host "Installation successful! You can now use '$ToolName' from any directory." -ForegroundColor Green
    Write-Host "You may need to close and reopen any command prompts for PATH changes to take effect." -ForegroundColor Yellow
} else {
    Write-Host "Installation completed, but '$ToolName' command is not immediately available." -ForegroundColor Yellow
    Write-Host "Please restart your command prompt to use the tool globally." -ForegroundColor Yellow
}

Write-Host "You can create a 'collect-files.config.json' file in any project directory to customize behavior." -ForegroundColor Cyan