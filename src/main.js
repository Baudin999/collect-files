#!/usr/bin/env node

const path = require('path');
// Updated path to require package.json from one directory up
const { version } = require('../package.json'); // For displaying version if needed

// Import modularized functions
const { readFile, writeFile } = require('./fs_utils'); // These are in the same src/ directory
const { loadConfig, createConfigFile, UNIVERSAL_INIT_CONFIG } = require('./config_manager');
const { parseArgs, showHelp, DEFAULT_CONFIG_FILENAME } = require('./cli_parser');
const { scanProjectFiles, findSystemFile } = require('./file_scanner');
const { processFileContent, pathToAnchor } = require('./file_processor');
// Note: ignore_handler.js is used internally by file_scanner.js

async function main() {
  try {
    const cliArgs = parseArgs(process.argv);

    if (cliArgs.help) {
      showHelp();
      return;
    }

    if (cliArgs.init) {
      await createConfigFile(cliArgs.configFile || DEFAULT_CONFIG_FILENAME, UNIVERSAL_INIT_CONFIG);
      return;
    }

    let config = await loadConfig(cliArgs.configFile);
    if (cliArgs.output) {
      config.output = cliArgs.output;
    }

    const currentWorkingDirectory = process.cwd();
    const scanRootPath = path.resolve(currentWorkingDirectory, cliArgs.directory);

    let systemFilePreamble = '';
    const systemFileInfo = await findSystemFile(scanRootPath, config);

    if (systemFileInfo) {
      console.log(`Using SYSTEM.txt found at: ${systemFileInfo.fullPath}`);
      try {
        const content = await readFile(systemFileInfo.fullPath, 'utf8');
        systemFilePreamble = `SYSTEM: ${content.trim()}\n\n`;
        if (systemFileInfo.relativePath && !config.ignore.includes(systemFileInfo.relativePath)) {
          config.ignore.push(systemFileInfo.relativePath);
        }
      } catch (err) {
        console.warn(`Could not read selected SYSTEM.txt ${systemFileInfo.fullPath}: ${err.message}`);
      }
    }

    const outputFileName = path.basename(config.output);
    if (outputFileName && !config.ignore.includes(outputFileName)) {
      config.ignore.push(outputFileName);
    }
    const outputPathRelativeToCwd = path.relative(currentWorkingDirectory, path.resolve(currentWorkingDirectory, config.output)).replace(/\\/g, '/');
    if (outputPathRelativeToCwd && !config.ignore.includes(outputPathRelativeToCwd) && outputPathRelativeToCwd !== outputFileName) {
      config.ignore.push(outputPathRelativeToCwd);
    }
    // Add metadata file for output to ignores.
    // This ensures that if output.md.meta.txt exists, it's not included.
    // The shouldIgnore in ignore_handler.js handles this based on config.metadataSuffix.
    // No explicit push here is needed if ignore_handler is correctly set up.

    console.log(`Starting scan in: ${scanRootPath}`);
    console.log(`Outputting to: ${path.resolve(currentWorkingDirectory, config.output)}`);
    if (config.ignore.length) console.log(`Effective ignore patterns (names/paths relative to scan root, or basenames): ${config.ignore.join(', ')}`);
    if (config.ignoreExtensions.length) console.log(`Ignoring extensions: ${config.ignoreExtensions.join(', ')}`);
    if (config.includeExtensions.length) console.log(`Including only extensions: ${config.includeExtensions.join(', ')}`);
    if (config.metadataSuffix) console.log(`Using metadata file suffix: ${config.metadataSuffix} (these will be ignored as primary files)`);


    const filesToProcess = await scanProjectFiles(scanRootPath, config);
    console.log(`Found ${filesToProcess.length} files matching criteria.`);

    if (filesToProcess.length === 0) {
        console.log("No files found to process. Output file will not be created or will be minimal.");
    }

    const processedFileMarkdownPromises = filesToProcess.map(fileInfo =>
      processFileContent(fileInfo, config)
    );
    const processedFileResults = await Promise.all(processedFileMarkdownPromises);

    const titleScanDir = path.relative(currentWorkingDirectory, scanRootPath).replace(/\\/g, '/') || '.';
    const mdHeader = [
      `# Project Files\n`,
      `*Generated on: ${new Date().toLocaleString()}*\n`,
      `*Tool Version: ${version}*\n`,
      `*Starting directory: ${titleScanDir}*\n\n`,
      `## Table of Contents\n`,
      ...processedFileResults.map(file => `- [${file.path}](#${pathToAnchor(file.path)})`),
      `\n`
    ].join('\n');

    const mdBody = processedFileResults.map(file => file.markdown).join('');
    const finalMarkdown = systemFilePreamble + mdHeader + mdBody;

    await writeFile(path.resolve(currentWorkingDirectory, config.output), finalMarkdown, 'utf8');
    console.log(`Successfully wrote ${processedFileResults.length} files to ${path.resolve(currentWorkingDirectory, config.output)}`);

  } catch (error) {
    console.error('An error occurred during execution:', error);
    process.exit(1);
  }
}

main();