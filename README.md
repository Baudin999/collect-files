# Packaging collect_files.js as a Standalone Executable

## Configuration File Placement

The tool looks for a configuration file named `collect-files.config.json` in the current working directory (the directory where you run the command from).

For example:
- If you run `collect_files.exe` from `C:\Projects\MyApp\`, it will look for `C:\Projects\MyApp\collect-files.config.json`
- If you run `collect_files.exe ./src` from `C:\Projects\MyApp\`, it will still look for the config in `C:\Projects\MyApp\collect-files.config.json`, but scan the `./src` directory

This allows you to place a custom configuration file in the root of each project you work with.

This guide will help you convert the Node.js script into a standalone executable that doesn't require Node.js to be installed on the target machine.

## Method 1: Using pkg (Simplest)

[pkg](https://github.com/vercel/pkg) is a tool by Vercel that packages your Node.js application into an executable.

### Steps:

1. Install pkg globally:
   ```
   npm install -g pkg
   ```

2. Package your application:
   ```
   pkg collect_files.js --target node16-win-x64 --output collect_files.exe
   ```

   This will create `collect_files.exe` that runs on 64-bit Windows with Node.js 16 built in.

3. You can now run it directly:
   ```
   collect_files.exe ./internal
   ```

### Options:

- For other operating systems, change the target:
  - Windows: `node16-win-x64`
  - macOS: `node16-macos-x64`
  - Linux: `node16-linux-x64`

## Method 2: Using nexe

[nexe](https://github.com/nexe/nexe) is another tool for creating standalone executables.

### Steps:

1. Install nexe globally:
   ```
   npm install -g nexe
   ```

2. Package your application:
   ```
   nexe collect_files.js -o collect_files.exe
   ```

3. Run the executable:
   ```
   collect_files.exe ./internal
   ```

## Method 3: Using electron-packager

For a more advanced solution with a GUI, you could use Electron.

1. First, convert your script into an Electron app
2. Then use electron-packager to create an executable

## Adding to PATH (For System-wide Access)

After creating your executable, you can make it available system-wide:

### Windows:

1. Move `collect_files.exe` to a permanent location (e.g., `C:\Tools\`)
2. Add that location to your PATH:
   - Right-click on "This PC" and select "Properties"
   - Click "Advanced system settings"
   - Click "Environment Variables"
   - Under "System variables", find "Path" and click "Edit"
   - Click "New" and add the path (e.g., `C:\Tools\`)
   - Click "OK" on all dialogs
3. Now you can run `collect_files.exe` from any directory in Command Prompt or PowerShell

## Usage in GitHub Actions or CI/CD

If you want to use this tool in automation pipelines:

1. Package the executable as described above
2. Include it in your repository or download it during the CI/CD process
3. Call it as part of your workflow: `collect_files.exe ./src`

## Compatibility Notes

- The standalone executable will be specific to the platform it was built for (Windows, macOS, Linux)
- The executable size will be larger (typically 30-60MB) because it includes the Node.js runtime
- Make sure to test the executable thoroughly in your target environment