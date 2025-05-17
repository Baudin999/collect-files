# local-win-install.ps1

param (
    [switch]$ElevatedRun, # Indicates script is re-launched specifically for elevation
    [switch]$PerformPrivilegedActionsOnly # New switch: tells the script to only run the privileged actions block
)

# --- Configuration ---
$ToolName = "collect-files"
$ToolsDir = "C:\Tools"
$SourceScriptRelativePath = "src\main.js" 

$ProjectRoot = $PSScriptRoot
$SourceScriptFullPath = Join-Path -Path $ProjectRoot -ChildPath $SourceScriptRelativePath
$BuildDir = Join-Path -Path $ProjectRoot -ChildPath "build"
$ExecutableName = "$ToolName.exe"
$PackagedExePathInBuild = Join-Path -Path $BuildDir -ChildPath $ExecutableName
$FinalExecutablePathInTools = Join-Path -Path $ToolsDir -ChildPath $ExecutableName
$DefaultConfigFileName = "collect-files.config.json"
$SourceConfigPath = Join-Path -Path $ProjectRoot -ChildPath $DefaultConfigFileName
$DestConfigPath = Join-Path -Path $ToolsDir -ChildPath $DefaultConfigFileName

# --- Helper Functions ---
function Test-IsAdmin {
    return ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Perform-NonPrivilegedActions {
    Write-Host "`n--- Performing Non-Privileged Actions ---" -ForegroundColor Magenta

    Write-Host "`nStep 1: Checking for 'pkg' global installation..."
    $pkgInstalled = npm list -g pkg --depth=0 2>$null | Select-String -Pattern "pkg@"
    if (-not $pkgInstalled) {
        Write-Host "'pkg' not found globally. Attempting to install..." -ForegroundColor Cyan
        npm install -g pkg
        if ($LASTEXITCODE -ne 0) { Write-Error "Failed to install 'pkg'."; return $false }
        Write-Host "'pkg' installed successfully." -ForegroundColor Green
    } else {
        Write-Host "'pkg' is already installed." -ForegroundColor Green
    }

    Write-Host "`nStep 2: Verifying source script '$SourceScriptFullPath' exists..."
    if (-not (Test-Path $SourceScriptFullPath)) { Write-Error "Source script not found at '$SourceScriptFullPath'!"; return $false }
    Write-Host "Source script found." -ForegroundColor Green

    Write-Host "`nStep 3: Ensuring local build directory '$BuildDir' exists..."
    if (-not (Test-Path $BuildDir)) {
        Write-Host "Creating build directory: $BuildDir" -ForegroundColor Cyan
        New-Item -ItemType Directory -Path $BuildDir -Force | Out-Null
    } else {
        Write-Host "Build directory already exists."
    }

    Write-Host "`nStep 4: Packaging '$SourceScriptRelativePath' to '$ExecutableName' locally..." -ForegroundColor Cyan
    pkg $SourceScriptFullPath --target node16-win-x64 --output $PackagedExePathInBuild
    if ($LASTEXITCODE -ne 0) { Write-Error "Failed to package the script using 'pkg' into '$BuildDir'."; return $false }
    Write-Host "Packaging completed successfully. Executable created at '$PackagedExePathInBuild'." -ForegroundColor Green
    
    return $true # Indicate success
}

function Perform-PrivilegedActionsOnly {
    Write-Host "`n--- Performing Privileged Actions Only (Elevated Context) ---" -ForegroundColor Magenta
    $IsAdmin = Test-IsAdmin
    if (-not $IsAdmin) {
        Write-Error "CRITICAL: Attempted to run Perform-PrivilegedActionsOnly without Administrator rights."
        Exit 1 # Exit with error code for the parent process
    }

    Write-Host "`nStep 5 (Privileged): Ensuring Tools directory '$ToolsDir' exists..."
    if (-not (Test-Path $ToolsDir)) {
        Write-Host "Creating directory: $ToolsDir" -ForegroundColor Cyan
        try { New-Item -ItemType Directory -Path $ToolsDir -Force -ErrorAction Stop | Out-Null }
        catch { Write-Error "Failed to create directory '$ToolsDir'. Error: $($_.Exception.Message)"; Exit 1 }
    } else { Write-Host "Tools directory '$ToolsDir' already exists." }
    Write-Host "Directory '$ToolsDir' confirmed." -ForegroundColor Green

    Write-Host "`nStep 6 (Privileged): Copying '$ExecutableName' to '$FinalExecutablePathInTools'..." -ForegroundColor Cyan
    try { Copy-Item -Path $PackagedExePathInBuild -Destination $FinalExecutablePathInTools -Force -ErrorAction Stop }
    catch { Write-Error "Failed to copy executable to '$ToolsDir'. Error: $($_.Exception.Message)"; Exit 1 }
    Write-Host "Executable copied successfully to '$FinalExecutablePathInTools'." -ForegroundColor Green

    Write-Host "`nStep 7 (Privileged): Checking and updating system PATH for '$ToolsDir'..."
    $currentSystemPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    if (-not ($currentSystemPath -split ";" -contains $ToolsDir)) {
        Write-Host "'$ToolsDir' not found in system PATH. Adding it..." -ForegroundColor Yellow
        try {
            $newSystemPath = "$currentSystemPath;$ToolsDir" -replace ';{2,}', ';'
            [Environment]::SetEnvironmentVariable("Path", $newSystemPath.TrimEnd(';'), "Machine")
            Write-Host "'$ToolsDir' added to system PATH successfully." -ForegroundColor Green
            Write-Host "IMPORTANT (from elevated process): You MUST close and reopen any command prompts for PATH changes to take effect." -ForegroundColor Yellow
        } catch { Write-Error "Failed to add '$ToolsDir' to system PATH. Error: $($_.Exception.Message)"; Exit 1 }
    } else { Write-Host "'$ToolsDir' is already in system PATH." -ForegroundColor Green }

    Write-Host "`nStep 8 (Privileged): Checking for default configuration file '$SourceConfigPath'..."
    if (Test-Path $SourceConfigPath) {
        Write-Host "Found configuration file. Copying to '$DestConfigPath'..." -ForegroundColor Cyan
        try { Copy-Item -Path $SourceConfigPath -Destination $DestConfigPath -Force -ErrorAction Stop }
        catch { Write-Warning "Could not copy configuration file '$SourceConfigPath' to '$DestConfigPath'. Error: $($_.Exception.Message)" } # Warning, not exiting
        Write-Host "Configuration file copied." -ForegroundColor Green
    } else { Write-Host "No default configuration file found at '$SourceConfigPath'. Skipping copy." }
    
    Write-Host "`nPrivileged actions completed. Exiting elevated process." -ForegroundColor Green
    Exit 0 # Indicate success to the parent process
}

# --- Main Script Logic ---

# Mode 1: Script is specifically told to ONLY perform privileged actions (because it was re-launched elevated)
if ($PerformPrivilegedActionsOnly.IsPresent) {
    if ($ElevatedRun.IsPresent) { # Double check it was meant to be elevated
        Perform-PrivilegedActionsOnly # This function will Exit 0 on success, Exit 1 on failure
    } else {
        Write-Error "Error: -PerformPrivilegedActionsOnly was set, but -ElevatedRun was not. This is an invalid state."
        Exit 1
    }
} else {
    # Mode 2: This is the initial run of the script (non-elevated or could be initially elevated by user)
    Write-Host "--- Local Windows Install for '$ToolName' (Initial Execution) ---" -ForegroundColor Yellow
    if ($ElevatedRun.IsPresent) {
        Write-Warning "Script started with -ElevatedRun but not -PerformPrivilegedActionsOnly. This may indicate an issue with re-launch logic."
    }

    $NonPrivilegedSuccess = Perform-NonPrivilegedActions
    if (-not $NonPrivilegedSuccess) {
        Write-Error "Non-privileged actions failed. Aborting."
        Pause
        Exit 1
    }

    # Now, check if we need to run privileged actions
    $IsCurrentlyAdmin = Test-IsAdmin
    $PrivilegedActionsCompleted = $false

    if ($IsCurrentlyAdmin) {
        Write-Host "`nRunning with Administrator privileges initially. Performing privileged actions directly..." -ForegroundColor Cyan
        # Call the function. It will Exit on failure, so if it returns, it was successful (or had non-fatal warnings).
        # To be more robust, Perform-PrivilegedActionsOnly could return $true/$false instead of Exit 0/1 if called directly.
        # For now, direct call means it manages its own exit (if error) or completes.
        # Let's adapt it to return status if called this way.
        # For simplicity with current structure, let's assume if it doesn't exit script, it implies success.
        # This part is tricky with the Exit 0/1 in the function.
        # A better way would be for Perform-PrivilegedActionsOnly to NOT Exit 0/1 if called directly.
        # Let's assume for now, if it's admin, we just run the steps:
        Write-Host "`nStep 5 (Privileged): Ensuring Tools directory '$ToolsDir' exists..."
        # ... (Repeat privileged steps here directly or call a modified function that returns status) ...
        # This duplication is what the previous model (full script re-run in elevated) avoided.
        # For clarity as requested, we'll proceed with re-launch for privileged parts even if initially admin,
        # or simply perform them if admin. Let's choose the latter for simplicity if already admin.

        # --- If already admin, perform privileged tasks directly ---
        Write-Host "`nStep 5 (Privileged): Ensuring Tools directory '$ToolsDir' exists..."
        if (-not (Test-Path $ToolsDir)) {
            try { New-Item -ItemType Directory -Path $ToolsDir -Force -ErrorAction Stop | Out-Null }
            catch { Write-Error "Failed to create directory '$ToolsDir'."; Pause; Exit 1 }
        }
        Write-Host "`nStep 6 (Privileged): Copying '$ExecutableName' to '$FinalExecutablePathInTools'..."
        try { Copy-Item -Path $PackagedExePathInBuild -Destination $FinalExecutablePathInTools -Force -ErrorAction Stop }
        catch { Write-Error "Failed to copy executable."; Pause; Exit 1 }
        
        Write-Host "`nStep 7 (Privileged): Updating system PATH..."
        $currentSystemPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
        if (-not ($currentSystemPath -split ";" -contains $ToolsDir)) {
            try {
                $newSystemPath = "$currentSystemPath;$ToolsDir" -replace ';{2,}', ';'
                [Environment]::SetEnvironmentVariable("Path", $newSystemPath.TrimEnd(';'), "Machine")
                Write-Host "'$ToolsDir' added to system PATH." -ForegroundColor Green
            } catch { Write-Error "Failed to add to PATH."; } # Continue for summary
        } else { Write-Host "'$ToolsDir' already in PATH."}

        Write-Host "`nStep 8 (Privileged): Copying config..."
        if (Test-Path $SourceConfigPath) {
            try { Copy-Item -Path $SourceConfigPath -Destination $DestConfigPath -Force -ErrorAction Stop }
            catch { Write-Warning "Could not copy config."}
        }
        $PrivilegedActionsCompleted = $true # Assume success if we got here

    } else {
        # --- Not admin, need to elevate for privileged actions ---
        Write-Host "`n--- Elevation Required for Deployment Actions (Steps 5-8) ---" -ForegroundColor Yellow
        Write-Host "The following operations require Administrator privileges:"
        Write-Host "  - Creating or writing to the '$ToolsDir' directory."
        Write-Host "  - Modifying the system PATH environment variable, etc."
        Write-Host "Attempting to re-launch specific part of script with elevated privileges..."
        Write-Host "Please approve the User Account Control (UAC) prompt."
        
        $ProcessArgs = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -ElevatedRun -PerformPrivilegedActionsOnly"
        $ElevatedProcess = Start-Process powershell -ArgumentList $ProcessArgs -Verb RunAs -PassThru -Wait
        
        if ($ElevatedProcess.ExitCode -eq 0) {
            Write-Host "Elevated privileged actions completed successfully." -ForegroundColor Green
            $PrivilegedActionsCompleted = $true
        } else {
            Write-Error "The elevated privileged actions failed (Exit Code: $($ElevatedProcess.ExitCode))."
            Write-Warning "Please check the administrator PowerShell window (if it remained open) for details."
            $PrivilegedActionsCompleted = $false
        }
    }

    # --- Final Summary (from initial script instance) ---
    Write-Host ""
    Write-Host "--- Overall Local Windows Install Summary ---" -ForegroundColor Green
    Write-Host "Tool '$ToolName' ($ExecutableName) non-privileged packaging completed."
    Write-Host "  - Source Script: $SourceScriptFullPath"
    Write-Host "  - Packaged Executable (local build): $PackagedExePathInBuild"
    
    if ($PrivilegedActionsCompleted) {
        Write-Host "Privileged deployment actions (to '$ToolsDir' and PATH update) were successful." -ForegroundColor Green
        Write-Host "  - Deployed to (system-wide): $FinalExecutablePathInTools"
        if ([Environment]::GetEnvironmentVariable("Path", "Machine") -split ";" -contains $ToolsDir) {
            Write-Host "The directory '$ToolsDir' IS in your system PATH." -ForegroundColor Green
        } else {
            Write-Host "The directory '$ToolsDir' may not yet be reflected in PATH for this current window, or addition failed. Please check new terminals." -ForegroundColor Yellow
        }
        Write-Host "You should be able to use the '$ToolName' command (the .exe version) from any NEW command prompt or PowerShell window on this machine."
    } else {
        Write-Warning "Privileged deployment actions were not completed successfully or were skipped."
        Write-Host "The executable is available in '$PackagedExePathInBuild'."
    }
    Write-Host "-------------------------------------------" -ForegroundColor Green
    Write-Host "Done."
    Pause
    Exit 0 # Initial script finishes
}