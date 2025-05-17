// src/cli_parser.js

const DEFAULT_CONFIG_FILENAME = 'collect-files.config.json';

/**
 * Parses command line arguments.
 * @param {string[]} argv - The process.argv array.
 * @returns {object} Parsed arguments.
 */
function parseArgs(argv) {
  const args = {
    help: false,
    init: false,
    output: null,
    configFile: DEFAULT_CONFIG_FILENAME, // Default config file name
    directory: '.',
  };

  // Start parsing from the 3rd element (index 2), after 'node' and script name
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') {
      args.help = true;
    } else if (arg === '-i' || arg === '--init') {
      args.init = true;
    } else if (arg === '-o' || arg === '--out') {
      if (i + 1 < argv.length) {
        args.output = argv[++i];
      } else {
        console.error('Error: -o or --out option requires a filename.');
        process.exit(1); // Or throw an error
      }
    } else if (arg === '-c' || arg === '--config') {
      if (i + 1 < argv.length) {
        args.configFile = argv[++i];
      } else {
        console.error('Error: -c or --config option requires a filename.');
        process.exit(1); // Or throw an error
      }
    } else if (!arg.startsWith('-')) {
      // Assumes the first non-option argument is the directory
      if (args.directory === '.') { // Only set if not already set (e.g. by a previous non-option arg)
        args.directory = arg;
      } else {
        console.warn(`Warning: Multiple directory arguments provided. Using '${args.directory}'. Ignoring '${arg}'.`);
      }
    } else {
      console.warn(`Warning: Unknown option '${arg}' ignored.`);
    }
  }
  return args;
}

/**
 * Displays the help message to the console.
 */
function showHelp() {
  console.log(`
Usage: collect-files [options] [directory]

Collects files from a directory and its subdirectories into a single markdown output.

Options:
  -h, --help                Show this help message.
  -i, --init                Create a '${DEFAULT_CONFIG_FILENAME}' with default settings
                            in the current directory.
  -o, --out <filename>      Specify the output markdown filename. Overrides the
                            filename in the config file.
  -c, --config <filename>   Specify a custom configuration file to use.
                            (Default: '${DEFAULT_CONFIG_FILENAME}')
  [directory]               The directory to scan. Defaults to the current
                            working directory ('.').

Configuration File ('${DEFAULT_CONFIG_FILENAME}'):
  The tool looks for a '${DEFAULT_CONFIG_FILENAME}' in the current working directory
  (or the directory specified by --config) to customize its behavior.

  Key properties:
  "output": "output.md"                 // Default output file name
  "ignore": ["node_modules", ".git"]    // List of directory/file names or relative paths to ignore
  "ignoreExtensions": ["exe", "png"]    // List of file extensions to ignore globally
  "includeExtensions": ["js", "ts"]     // If non-empty, only files with these extensions are included
                                        // (after 'ignore' and 'ignoreExtensions' are applied)
  "metadataSuffix": ".meta.txt"         // Suffix for files containing metadata for preceding code files
  "compressionRules": []                // Rules for applying content compression/summarization
                                        // (e.g., extracting only class/method signatures)

See the documentation for more details on configuration options.
`);
}

module.exports = {
  parseArgs,
  showHelp,
  DEFAULT_CONFIG_FILENAME
};