#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

// Promisify fs functions
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

// Default configuration (used if no config file is found and --init is not used)
const DEFAULT_CONFIG = {
  output: 'output.md',
  ignore: [ // Simple list of directory/file names or full relative paths
    'node_modules',
    '.git',
    // Output file and SYSTEM.txt are added dynamically
  ],
  ignoreExtensions: [], // List of extensions to ignore
  includeExtensions: [] // If non-empty, only these extensions are included (after ignores)
};

// Universal config template for --init (will use simple ignores)
const UNIVERSAL_INIT_CONFIG = {
  output: 'output.md',
  ignore: [
    // Common directory/file names to ignore
    '.git', '.svn', '.hg',
    '.vscode', '.idea', '.vs', '.fleet',
    '.DS_Store', 'Thumbs.db', 'desktop.ini',
    'node_modules', 'bower_components',
    'vendor',       // PHP Composer, Ruby Gems, Go
    'target',       // Rust, Java (Maven/Scala)
    'build',        // Generic, CMake, Gradle, JS bundlers
    'dist',         // Generic, Python, JS bundlers
    'out',          // Generic, Go, some compilers
    'bin',          // .NET, Go, generic compiled output
    'obj',          // .NET intermediate
    'wwwroot',      // ASP.NET Core (often contains bundled/static assets)
    'elm-stuff',    // Elm
    '_build',       // OCaml (dune), Elixir (mix)
    'zig-cache', 'zig-out', // Zig
    '.next',        // Next.js
    '.nuxt',        // Nuxt.js
    '.svelte-kit',  // SvelteKit
    '.angular',     // Angular cache/build
    'coverage', 'lcov-report', '.nyc_output', 'JacocoReport',
    'TestResults',
    '.env',         // Dotenv files (sensitive)
    '__pycache__', '.venv', 'venv', 'env', '.tox', '.nox', '.eggs',
    '.gradle',
    'tmp',          // Rails temp files, generic temp
    '_esy',
    // Specific filenames
    'npm-debug.log', 'yarn-debug.log', 'yarn-error.log',
    // Note: Output file itself is added dynamically.
    // Note: SYSTEM.txt is added dynamically if found and processed.
  ],
  ignoreExtensions: [
    // Executables & Libraries
    'exe', 'dll', 'so', 'dylib', 'o', 'a', 'lib', 'bundle',
    // Compiled/Intermediate Artifacts
    // 'obj' extension is covered here if not ignoring 'obj' directory by name
    'pdb', 'idb', 'exp', 'pch',
    'class', // Java
    'pyc', 'pyo', // Python
    'map', // Source maps
    // Archives & Packages
    'zip', 'tar', 'gz', 'bz2', 'xz', 'rar', '7z',
    'jar', 'war', 'ear', 'nupkg', 'gem', 'pkg', 'deb', 'rpm', 'msi', 'dmg',
    // Common Image Formats
    'png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff', 'tif', 'webp', 'ico',
    // Audio & Video Formats
    'mp3', 'wav', 'aac', 'ogg', 'oga', 'flac',
    'mp4', 'mkv', 'mov', 'avi', 'webm', 'flv',
    // Document Formats
    'pdf', 'doc', 'docx', 'odt', 'xls', 'xlsx', 'ods', 'ppt', 'pptx', 'odp',
    // Data & Database Files
    'csv',
    'mdb', 'accdb', 'db', 'sqlite', 'sqlite3', 'sqlitedb', 'sdf', 'mdf', 'ldf',
    // Font Files
    'woff', 'woff2', 'ttf', 'otf', 'eot',
    // User-specific IDE/Editor settings files
    'suo', 'user',
    'DotSettings', 'sln.DotSettings',
    // Compiled language specific
    'cmo', 'cmi', 'cmx', 'cma', 'cmxa', 'cmxs', // OCaml
    'beam', // Erlang/Elixir
    // LaTeX auxiliary files
    'aux', 'lof', 'log', 'lot', 'fls', 'toc', // .log also typically ignored
    'bak', // General backup extension
    'swp', 'swo', // Vim swap files
    'tmp' // .tmp extension
  ],
  includeExtensions: [] // Empty by default: include all not ignored files
};

// Parse command line arguments
function parseArgs() {
  const args = {
    help: false, init: false, output: null, configFile: 'collect-files.config.json', directory: '.',
  };
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === '-h' || arg === '--help') args.help = true;
    else if (arg === '-i' || arg === '--init') args.init = true;
    else if (arg === '-o' || arg === '--out') args.output = process.argv[++i];
    else if (arg === '-c' || arg === '--config') args.configFile = process.argv[++i];
    else if (!arg.startsWith('-')) args.directory = arg;
  }
  return args;
}

// Display help message
function showHelp() {
  console.log(`
Usage: collect-files [options] [directory]

Options:
  -h, --help                Show this help message.
  -i, --init                Create 'collect-files.config.json' with simplified defaults.
                            Ignores are based on exact directory/file names or extensions.
                            If 'SYSTEM.txt' (case-sensitive) is found recursively, it's prepended.
  -o, --out <filename>      Specify output filename.
  -c, --config <filename>   Specify config file.

Configuration ('collect-files.config.json'):
  "ignore": ["dir_name_to_ignore", "file_name_to_ignore.ext"],
  "ignoreExtensions": ["ext_to_ignore_globally"],
  "includeExtensions": ["js", "ts"] (if non-empty, acts as a whitelist after ignores)
`);
}

// Create a default config file
async function createConfigFile(configTemplate) {
  const configFilePath = path.resolve(process.cwd(), 'collect-files.config.json');
  if (fs.existsSync(configFilePath)) {
    console.warn(`Warning: Config file '${configFilePath}' already exists. No changes made.`);
    return;
  }
  try {
    await writeFile(configFilePath, JSON.stringify(configTemplate, null, 2), 'utf8');
    console.log(`Successfully created config file: ${configFilePath}`);
  } catch (error) {
    console.error(`Error creating config file: ${error.message}`); process.exit(1);
  }
}

// Glob-like pattern matching (kept for SYSTEM.txt search or future use, not for main ignore)
function isMatch(filePath, pattern) {
  const normalizedFilePath = filePath.replace(/\\/g, '/');
  let normalizedPattern = pattern.replace(/\\/g, '/');
  let regexPattern = normalizedPattern.replace(/\*\*/g, '###GLOBSTAR###')
    .replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]')
    .replace(/###GLOBSTAR###/g, '.*')
    .replace(/[.+^${}()|[\]\\]/g, '\\$&');
  try {
    return new RegExp(`^${regexPattern}$`, 'i').test(normalizedFilePath);
  } catch (e) {
    console.warn(`Invalid regex from glob: ${pattern}. Err: ${e.message}`); return false;
  }
}

// Load configuration
async function loadConfig(configFilePath) {
  try {
    const resolvedPath = path.resolve(process.cwd(), configFilePath);
    if (fs.existsSync(resolvedPath)) {
      console.log(`Using config file: ${resolvedPath}`);
      const userConfig = JSON.parse(await readFile(resolvedPath, 'utf8'));
      return {
        ...DEFAULT_CONFIG, ...userConfig,
        ignore: userConfig.ignore !== undefined ? userConfig.ignore : DEFAULT_CONFIG.ignore,
        ignoreExtensions: userConfig.ignoreExtensions !== undefined ? userConfig.ignoreExtensions : DEFAULT_CONFIG.ignoreExtensions,
        includeExtensions: userConfig.includeExtensions !== undefined ? userConfig.includeExtensions : DEFAULT_CONFIG.includeExtensions,
      };
    } else { console.log(`No config file at '${resolvedPath}'. Using default.`); }
  } catch (error) { console.warn(`Failed to load config '${configFilePath}': ${error.message}. Using default.`); }
  return { ...DEFAULT_CONFIG };
}

// SIMPLIFIED: Check if item should be ignored
function shouldIgnore(itemPath, isDirectory, config) {
  const normalizedItemPath = itemPath.replace(/\\/g, '/'); // Full relative path, e.g., "CLI/bin/ignored.ms"
  const itemName = path.basename(normalizedItemPath);       // Just the name, e.g., "ignored.ms" or "bin"

  if (isDirectory) {
    // Rule 2: For Directories
    // Ignore if directory's name OR its full relative path exactly matches an entry in config.ignore
    for (const ignoreEntry of config.ignore) {
      const normalizedIgnoreEntry = ignoreEntry.replace(/\\/g, '/').trim();
      if (itemName === normalizedIgnoreEntry || normalizedItemPath === normalizedIgnoreEntry) {
        return true;
      }
    }
    return false; // Directory not ignored by name or full path
  } else {
    // Rule 1: For Files
    // Ignore if file's extension is in config.ignoreExtensions
    const fileExtension = path.extname(normalizedItemPath).substring(1).toLowerCase();
    if (config.ignoreExtensions.length > 0 && config.ignoreExtensions.includes(fileExtension)) {
      return true;
    }

    // Ignore if file's name OR its full relative path exactly matches an entry in config.ignore
    for (const ignoreEntry of config.ignore) {
      const normalizedIgnoreEntry = ignoreEntry.replace(/\\/g, '/').trim();
      if (itemName === normalizedIgnoreEntry || normalizedItemPath === normalizedIgnoreEntry) {
        return true;
      }
    }

    // Apply includeExtensions logic (if non-empty, acts as a whitelist)
    if (config.includeExtensions.length > 0) {
      if (!config.includeExtensions.includes(fileExtension)) {
        return true;
      }
    }
    return false; // File not ignored
  }
}

// Recursively scan directory for main files
async function scanDirectory(dirPath, config, basePath, filesList) {
  const relativeDirPath = path.relative(basePath, dirPath) || '.';
  // Check if the directory itself should be ignored
  if (relativeDirPath !== '.' && shouldIgnore(relativeDirPath, true, config)) {
    return; // Directory is ignored, so don't process its contents
  }

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullEntryPath = path.join(dirPath, entry.name);
      const relativeEntryPath = path.relative(basePath, fullEntryPath);

      // Check if this specific entry (file or sub-directory) should be ignored
      if (shouldIgnore(relativeEntryPath, entry.isDirectory(), config)) {
        continue;
      }

      if (entry.isDirectory()) {
        await scanDirectory(fullEntryPath, config, basePath, filesList);
      } else if (entry.isFile()) {
        filesList.push({ path: relativeEntryPath, fullPath: fullEntryPath });
      }
    }
  } catch (error) {
    if (error.code === 'EPERM' || error.code === 'EACCES') console.warn(`Permission denied scanning ${dirPath}.`);
    else console.error(`Error scanning dir ${dirPath}: ${error.message}`);
  }
}

// Process file for markdown
async function processFile(fileInfo) {
  const normalizedPath = fileInfo.path.replace(/\\/g, '/');
  try {
    const fileExtension = path.extname(normalizedPath).toLowerCase();
    const commonBinaryExtensions = [
      '.exe', '.dll', '.so', '.dylib', '.o', '.a', '.lib', '.bundle', '.obj', '.pdb', '.class', '.pyc', '.pyo', '.beam',
      '.cmo', '.cmi', '.cmx', '.zip', '.tar', '.gz', '.rar', '.7z', '.jar', '.war', '.nupkg', '.pkg', '.dmg',
      '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.webp', '.ico', '.mp3', '.wav', '.ogg', '.mp4', '.mov',
      '.avi', '.pdf', '.woff', '.woff2', '.ttf', '.otf', '.eot', '.sqlite', '.db', '.dat'
    ]; // This list is for identifying binaries if they somehow bypass extension ignore
    if (commonBinaryExtensions.includes(fileExtension)) {
      return { ...fileInfo, markdown: `## ${normalizedPath}\n\n*Binary file (ext: ${fileExtension}) - content not included*\n\n` };
    }
    let content;
    try { content = await readFile(fileInfo.fullPath, 'utf8'); }
    catch (readError) { return { ...fileInfo, markdown: `## ${normalizedPath}\n\n*Unable to read file as text (Err: ${readError.code}) - likely binary/unsupported encoding*\n\n` }; }
    content = content.replace(/\`\`\`/g, '\\`\\`\\`');
    const MAX_LEN = 200000;
    if (content.length > MAX_LEN) content = content.substring(0, MAX_LEN) + `\n\n... [Content truncated] ...`;
    const lang = fileExtension.substring(1) || 'text';
    return { ...fileInfo, markdown: `## ${normalizedPath}\n\n\`\`\`${lang}\n${content}\n\`\`\`\n\n` };
  } catch (error) {
    console.error(`Error processing ${normalizedPath}: ${error.message}`);
    return { ...fileInfo, markdown: `## ${normalizedPath}\n\n**Error processing file: ${error.message}**\n\n` };
  }
}

function pathToAnchor(filePath) {
  return filePath.toLowerCase().replace(/\\/g, '/').replace(/[^a-z0-9\/-]/g, '-').replace(/\/+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

// Helper function for finding SYSTEM.txt recursively
async function findSystemTxtRecursive(currentDir, baseScanPath, configForSystemSearch, foundSystemFilesList) {
    let entries;
    try {
        entries = await readdir(currentDir, { withFileTypes: true });
    } catch (err) {
        if (err.code === 'EPERM' || err.code === 'EACCES') console.warn(`SYSTEM.txt search: Permission denied in ${currentDir}.`);
        // else console.warn(`SYSTEM.txt search: Error reading ${currentDir}: ${err.message}`); // Can be noisy
        return;
    }

    for (const entry of entries) {
        const fullEntryPath = path.join(currentDir, entry.name);
        const relativeEntryPathFromBaseScan = path.relative(baseScanPath, fullEntryPath);

        if (entry.name === 'SYSTEM.txt' && entry.isFile()) {
            foundSystemFilesList.push({
                fullPath: fullEntryPath,
                relativePath: relativeEntryPathFromBaseScan.replace(/\\/g, '/')
            });
        } else if (entry.isDirectory()) {
            // For SYSTEM.txt search, we use a simplified check:
            // if the directory name is in config.ignore (not the full path, just name like "node_modules")
            let ignoreThisDir = false;
            const dirName = entry.name;
            for (const ignorePattern of configForSystemSearch.ignore) { // Use the specific config for system search
                if (dirName === ignorePattern.replace(/\\/g, '/').trim()) {
                     ignoreThisDir = true;
                     break;
                }
            }
            // Also respect a few hardcoded essential ignores for system search
            if (['.git', 'node_modules'].includes(dirName)) {
                ignoreThisDir = true;
            }

            if (!ignoreThisDir) {
                await findSystemTxtRecursive(fullEntryPath, baseScanPath, configForSystemSearch, foundSystemFilesList);
            }
        }
    }
}

// Main execution
async function main() {
  try {
    const args = parseArgs();
    if (args.help) { showHelp(); return; }
    if (args.init) { await createConfigFile(UNIVERSAL_INIT_CONFIG); return; }

    let config = await loadConfig(args.configFile);
    if (args.output) config.output = args.output;

    const startDirArg = args.directory;
    const scanRootPath = path.resolve(process.cwd(), startDirArg);
    const basePath = process.cwd();

    let systemFilePreamble = '';
    const foundSystemFiles = [];
    // Use a copy of config for system search, or a minimal one if necessary,
    // to avoid SYSTEM.txt itself being ignored by a generic pattern during its own search.
    // For now, pass the main config; the recursive search primarily respects directory name ignores.
    await findSystemTxtRecursive(scanRootPath, scanRootPath, config, foundSystemFiles);

    if (foundSystemFiles.length > 0) {
        foundSystemFiles.sort((a, b) => {
            const depthA = a.relativePath.split('/').length;
            const depthB = b.relativePath.split('/').length;
            if (depthA !== depthB) return depthA - depthB;
            return a.relativePath.localeCompare(b.relativePath);
        });
        const selectedSystemFile = foundSystemFiles[0];
        console.log(`Using SYSTEM.txt found at: ${selectedSystemFile.fullPath}`);
        try {
            const content = await readFile(selectedSystemFile.fullPath, 'utf8');
            systemFilePreamble = `SYSTEM: ${content.trim()}\n\n`;
            const relativePathForMainIgnore = path.relative(basePath, selectedSystemFile.fullPath).replace(/\\/g, '/');
            if (!config.ignore.includes(relativePathForMainIgnore)) { // Check exact match
                config.ignore.push(relativePathForMainIgnore);
            }
        } catch (err) { console.warn(`Could not read selected SYSTEM.txt ${selectedSystemFile.fullPath}: ${err.message}`); }
    }

    const outputFileName = config.output; // Use just the filename for the output file ignore
    if (outputFileName && !config.ignore.includes(outputFileName)) {
      config.ignore.push(outputFileName);
    }
    // Also add the full relative path of the output file to ignore, if it's not at top level
    const relativeOutputFilePath = path.relative(basePath, path.resolve(basePath, config.output)).replace(/\\/g, '/');
    if (relativeOutputFilePath && !config.ignore.includes(relativeOutputFilePath) && relativeOutputFilePath !== outputFileName) {
        config.ignore.push(relativeOutputFilePath);
    }


    console.log(`Starting scan in: ${scanRootPath}`);
    console.log(`Output file: ${path.resolve(basePath, config.output)}`);
    if (config.ignore.length) console.log(`Ignoring (exact names/paths): ${config.ignore.join(', ')}`);
    if (config.ignoreExtensions.length) console.log(`Ignoring extensions: ${config.ignoreExtensions.join(', ')}`);


    const filesToProcess = [];
    await scanDirectory(scanRootPath, config, basePath, filesToProcess);
    console.log(`Found ${filesToProcess.length} files matching criteria.`);
    filesToProcess.sort((a, b) => a.path.localeCompare(b.path));

    const processedFileContents = await Promise.all(filesToProcess.map(processFile));
    const titleScanDir = path.relative(basePath, scanRootPath).replace(/\\/g, '/') || '.';
    const mdHeader = [
      `# Project Files\n`, `*Generated on: ${new Date().toLocaleString()}*\n`,
      `*Starting directory: ${titleScanDir}*\n\n`, `## Table of Contents\n`,
      ...processedFileContents.map(file => `- [${file.path.replace(/\\/g, '/')}](#${pathToAnchor(file.path)})`), `\n`
    ].join('\n');
    const mdBody = processedFileContents.map(file => file.markdown).join('');
    await writeFile(path.resolve(basePath, config.output), systemFilePreamble + mdHeader + mdBody, 'utf8');
    console.log(`Wrote ${filesToProcess.length} files to ${path.resolve(basePath, config.output)}`);
  } catch (error) { console.error('Main error:', error); process.exit(1); }
}

main();