// src/config_manager.js
const path = require('path');
const { readFile, writeFile, existsSync } = require('./fs_utils'); // Using our promisified utils

// Default configuration (used if no config file is found and --init is not used)
const DEFAULT_CONFIG = {
  output: 'output.md',
  ignore: [ // Simple list of directory/file names or full relative paths
    'node_modules',
    '.git',
    // Output file and SYSTEM.txt are added dynamically
  ],
  ignoreExtensions: [], // List of extensions to ignore
  includeExtensions: [], // If non-empty, only these extensions are included (after ignores)
  metadataSuffix: '.meta.txt', // New: Suffix for metadata files
  compressionRules: [] // New: Rules for content compression
  // Example compression rule:
  // {
  //   pathPattern: "src/services/**/*.js", // Glob pattern for files/directories
  //   strategy: "summarize_js_class", // "extract_signatures", "custom_script"
  //   options: {} // Options specific to the strategy
  // }
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
    'collect-files.config.json'
    // Note: Output file itself is added dynamically.
    // Note: SYSTEM.txt is added dynamically if found and processed.
  ],
  ignoreExtensions: [
    // Executables & Libraries
    'exe', 'dll', 'so', 'dylib', 'o', 'a', 'lib', 'bundle',
    // Compiled/Intermediate Artifacts
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
  includeExtensions: [], // Empty by default: include all not ignored files
  metadataSuffix: '.meta.txt',
  compressionRules: []
};

/**
 * Loads configuration from a JSON file.
 * @param {string} configFilePath - Path to the configuration file.
 * @returns {Promise<object>} The loaded and merged configuration.
 */
async function loadConfig(configFilePath) {
  try {
    const resolvedPath = path.resolve(process.cwd(), configFilePath);
    if (existsSync(resolvedPath)) { // Use sync version as it's a one-time setup check
      console.log(`Using config file: ${resolvedPath}`);
      const userConfigStr = await readFile(resolvedPath, 'utf8');
      const userConfig = JSON.parse(userConfigStr);
      
      // Deep merge with default config, ensuring arrays are handled correctly
      // For simplicity, we'll just overwrite arrays if present in userConfig.
      // A more sophisticated merge might concatenate or uniquely merge array items.
      const mergedConfig = {
        ...DEFAULT_CONFIG,
        ...userConfig,
        ignore: userConfig.ignore !== undefined ? userConfig.ignore : DEFAULT_CONFIG.ignore,
        ignoreExtensions: userConfig.ignoreExtensions !== undefined ? userConfig.ignoreExtensions : DEFAULT_CONFIG.ignoreExtensions,
        includeExtensions: userConfig.includeExtensions !== undefined ? userConfig.includeExtensions : DEFAULT_CONFIG.includeExtensions,
        compressionRules: userConfig.compressionRules !== undefined ? userConfig.compressionRules : DEFAULT_CONFIG.compressionRules,
        metadataSuffix: userConfig.metadataSuffix !== undefined ? userConfig.metadataSuffix : DEFAULT_CONFIG.metadataSuffix,
      };
      return mergedConfig;
    } else {
      console.log(`No config file at '${resolvedPath}'. Using default configuration.`);
    }
  } catch (error) {
    console.warn(`Failed to load or parse config '${configFilePath}': ${error.message}. Using default configuration.`);
  }
  return { ...DEFAULT_CONFIG }; // Return a copy of default config
}

/**
 * Creates a default config file.
 * @param {string} desiredConfigFilePath - The path where the config file should be created.
 * @param {object} configTemplate - The template object to write.
 */
async function createConfigFile(desiredConfigFilePath, configTemplate) {
  const targetPath = path.resolve(process.cwd(), desiredConfigFilePath);
  if (existsSync(targetPath)) {
    console.warn(`Warning: Config file '${targetPath}' already exists. No changes made.`);
    return;
  }
  try {
    await writeFile(targetPath, JSON.stringify(configTemplate, null, 2), 'utf8');
    console.log(`Successfully created config file: ${targetPath}`);
  } catch (error) {
    console.error(`Error creating config file '${targetPath}': ${error.message}`);
    // Re-throw or handle as per application's error handling strategy
    throw error; 
  }
}

module.exports = {
  DEFAULT_CONFIG,
  UNIVERSAL_INIT_CONFIG,
  loadConfig,
  createConfigFile,
};