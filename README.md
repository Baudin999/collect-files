
# Collect Files Tool

A command-line utility to recursively collect files from a directory and its subdirectories into a single, structured markdown document. Ideal for preparing codebases or project files for review, documentation, or input into Large Language Models (LLMs).

## Features

*   **Recursive File Collection:** Scans directories and subdirectories.
*   **Markdown Output:** Generates a single markdown file with a table of contents.
*   **Customizable Ignoring:**
    *   Ignore specific directory names (e.g., `node_modules`, `.git`).
    *   Ignore specific file names or full relative paths.
    *   Ignore files by extension (e.g., `.log`, `.tmp`).
    *   Optionally, include only files with specific extensions (whitelist).
*   **`SYSTEM.txt` Preamble:** If a `SYSTEM.txt` file is found (closest to the scan root), its content is prepended to the output.
*   **File-Specific Metadata:** Supports `.meta.txt` files (e.g., `yourfile.js.meta.txt`) to add custom notes or instructions before a file's content in the markdown.
*   **Configuration File:** Uses `collect-files.config.json` in the current working directory for detailed control.
*   **Command-Line Options:** For quick overrides and basic operations like initialization.
*   **Binary File Handling:** Identifies common binary files and notes them without including their content.
*   **Large File Truncation:** Truncates very large text files to keep the output manageable.

## Installation

There are two main ways to install and use `collect-files`:

### 1. Recommended: Global Installation via npm (Cross-Platform)

This method installs `collect-files` as a global command-line tool using Node.js and npm. Users will need Node.js (version 14.0.0 or higher recommended) installed.

```bash
npm install -g collect-files
```

After installation, you can run the tool from any directory:
```bash
collect-files [options] [directory]
```

### 2. Alternative: Windows Standalone Executable (Developer/Specific Use)

For Windows users who may not have Node.js installed, or for specific distribution needs, a standalone `.exe` can be built from the source. This is primarily intended for developers of this tool or for specific deployment scenarios.

1.  **Clone the repository (if you haven't already):**
    ```bash
    git clone https://github.com/yourusername/collect-files.git
    cd collect-files
    ```
    *(Replace `yourusername/collect-files` with your actual repository URL)*

2.  **Install dependencies (for building):**
    ```bash
    npm install
    ```

3.  **Build the `.exe`:**
    This command creates `collect_files.exe` in the `./build` directory.
    ```bash
    npm run build
    ```
    You can then copy this `.exe` to any location and run it.

4.  **Optional: Install the `.exe` system-wide on Windows (Developer Convenience):**
    The project includes a PowerShell script to package the `.exe` and install it into `C:\Tools`, adding this directory to your system PATH. This makes the `.exe` version runnable from any command prompt.
    **Run PowerShell as Administrator** and execute:
    ```bash
    npm run install-local-win
    ```
    *(This will guide you through the process, including UAC prompts if needed).*

## Usage

### Command Line

```bash
collect-files [options] [directory_to_scan]
```

**Options:**

*   `-h, --help`: Show the help message.
*   `-i, --init`: Create a `collect-files.config.json` file with default settings in the current directory.
*   `-o, --out <filename>`: Specify the output markdown filename. Overrides the filename in the config file.
*   `-c, --config <filename>`: Specify a custom configuration file to use (Default: `collect-files.config.json`).
*   `[directory_to_scan]`: The directory to scan. Defaults to the current working directory (`.`).

**Examples:**

*   Collect files from the current directory, using `collect-files.config.json` if present, outputting to `output.md` (or as configured):
    ```bash
    collect-files
    ```
*   Collect files from a subdirectory named `src`:
    ```bash
    collect-files ./src
    ```
*   Initialize a new configuration file:
    ```bash
    collect-files --init
    ```
*   Specify a different output file:
    ```bash
    collect-files --out project_snapshot.md ./my_project
    ```

### Configuration File (`collect-files.config.json`)

The tool looks for a configuration file named `collect-files.config.json` in the **current working directory** (the directory where you run the `collect-files` command from). This allows you to have project-specific configurations.

**Example `collect-files.config.json`:**

```json
{
  "output": "project_files.md",
  "ignore": [
    ".git",
    "node_modules",
    "dist",
    "build",
    "coverage",
    "secret_config.txt",
    "src/temp_files/" 
  ],
  "ignoreExtensions": [
    "log",
    "tmp",
    "swp",
    "exe", "dll", "so", "o",
    "png", "jpg", "jpeg", "gif",
    "zip", "tar", "gz"
  ],
  "includeExtensions": [
    // If non-empty, only these extensions are processed (after other ignores)
    // e.g., "js", "ts", "py", "md", "json"
  ],
  "metadataSuffix": ".meta.txt"
  // "compressionRules": [] // Placeholder for future content compression features
}
```

**Key Configuration Properties:**

*   `output` (string): The name of the markdown file to generate.
*   `ignore` (array of strings): A list of directory names, file names, or relative paths (from the scan root) to ignore.
    *   Example: `"node_modules"` will ignore any directory named `node_modules`.
    *   Example: `"src/legacy/old_code.js"` will ignore that specific file if the scan root includes `src`.
*   `ignoreExtensions` (array of strings): A list of file extensions (without the leading dot) to ignore globally.
*   `includeExtensions` (array of strings): If this array is non-empty, it acts as a whitelist. Only files with these extensions will be included *after* the `ignore` and `ignoreExtensions` rules have been applied.
*   `metadataSuffix` (string, e.g., `".meta.txt"`): Files ending with this suffix (e.g., `myfile.js.meta.txt`) will be treated as metadata for their corresponding main file (`myfile.js`). Their content will be prepended to the main file's section in the markdown. These metadata files themselves will not appear as separate entries in the table of contents.
*   `compressionRules` (array of objects, *future feature*): Planned for defining rules to summarize or compress content from specific files or directories (e.g., extracting only class/method signatures).

### `SYSTEM.txt` Handling

If a file named `SYSTEM.txt` (case-sensitive) is found within the scanned directory structure, its content will be prepended to the very beginning of the generated markdown output. If multiple `SYSTEM.txt` files are found, the one at the shallowest directory depth (closest to the scan root) will be used. This is useful for providing overall context or system-level instructions. The `SYSTEM.txt` file itself will then be excluded from the main file listing.

### Metadata Files (`.meta.txt`)

For any file (e.g., `script.js`), you can create a corresponding metadata file (e.g., `script.js.meta.txt` - assuming `metadataSuffix` is `".meta.txt"`). The content of this metadata file will be included in the final markdown output, just above the content of `script.js`. This allows you to provide specific context, instructions, or annotations for individual files.

## Developer Guide

### Building the Standalone Executable

If you need to create a standalone `.exe` (e.g., for distribution to Windows users without Node.js):

1.  Ensure all dependencies are installed: `npm install`
2.  Run the build script:
    ```bash
    npm run build
    ```
    This will use `pkg` to package `src/main.js` and place `collect-files.exe` in the `./build` directory.

### Local Windows Install Script (for the `.exe`)

To install the locally built `.exe` to `C:\Tools` and add it to your PATH (for development convenience on Windows):

1.  Make sure you've run `npm run build` at least once.
2.  Run PowerShell as Administrator.
3.  Execute:
    ```bash
    npm run install-local-win
    ```

### Compatibility Notes for `.exe`

*   The standalone executable created by `pkg` will be specific to the platform it was built for (the `npm run build` script targets Windows x64).
*   The executable size will be larger (typically 30-60MB or more) because it includes the Node.js runtime.
*   Test the executable thoroughly in your target environment.

## Usage in CI/CD (e.g., GitHub Actions)

1.  **Using Node.js version (Recommended for CI):**
    *   Ensure Node.js is available in your CI environment.
    *   Install the tool: `npm install -g collect-files`
    *   Run it: `collect-files ./path-to-scan -o output.md`
2.  **Using the packaged `.exe`:**
    *   Build the executable as part of your CI process or commit a pre-built executable (ensure it matches your CI runner's OS).
    *   Call the executable: `./build/collect-files.exe ./path-to-scan -o output.md`

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests. (Further details can be added here, like coding standards, running tests, etc.)

## License

MIT License - See the `LICENSE` file for details.


**Key changes and considerations in this README:**

*   **Installation:** Clearly separates the `npm install -g` method (recommended for general users) from the Windows `.exe` build/install process (more for developers or specific scenarios).
*   **Script Names:** Updated to reflect `npm run build` (for `.exe` creation) and `npm run install-local-win` (for PowerShell install script).
*   **Usage Examples:** Updated to use `collect-files` as the command, assuming npm global install.
*   **Configuration:** Detailed explanation of `collect-files.config.json` and its key fields, including `metadataSuffix`.
*   **Features:** Added `SYSTEM.txt` and `.meta.txt` to the features list and explained them.
*   **Developer Guide:** Clear instructions for developers on how to build the `.exe` and use the local install script.
*   **CI/CD:** Provided options for both Node.js based and `.exe` based usage in CI.
*   **Repository Links:** Added placeholders for `yourusername/collect-files`. **Remember to replace these with your actual GitHub repository URL.**
*   **Removed outdated `pkg` / `nexe` instructions:** As these are now abstracted by `npm run build`.
