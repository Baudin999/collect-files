// src/file_scanner.js
const path = require('path');
const { readdir, stat } = require('./fs_utils');
const { shouldIgnore } = require('./ignore_handler');

/**
 * Recursively scans a directory for project files based on the configuration.
 *
 * @param {string} currentDirPath - The absolute path of the directory to scan currently.
 * @param {string} baseScanPath - The absolute path of the initial directory where scanning started.
 *                                This is used to calculate relative paths for output.
 * @param {object} config - The application configuration object.
 * @param {Array<{path: string, fullPath: string}>} filesList - Accumulator for found files.
 * @returns {Promise<void>}
 */
async function scanDirectoryRecursive(currentDirPath, baseScanPath, config, filesList) {
  // Calculate relative path of the current directory from the *baseScanPath*
  // This relative path is what's checked against ignore rules for directories.
  const relativeCurrentDirPath = path.relative(baseScanPath, currentDirPath) || '.';

  // Check if the current directory itself (by its relative path) should be ignored.
  // Don't check for '.' (the root of the scan) itself, only subdirectories.
  if (relativeCurrentDirPath !== '.' && shouldIgnore(relativeCurrentDirPath, true, config)) {
    // console.log(`Ignoring directory by relative path: ${relativeCurrentDirPath}`);
    return;
  }

  let entries;
  try {
    entries = await readdir(currentDirPath, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'EPERM' || error.code === 'EACCES') {
      console.warn(`Permission denied scanning directory: ${currentDirPath}. Skipping.`);
    } else {
      console.error(`Error reading directory ${currentDirPath}: ${error.message}. Skipping.`);
    }
    return;
  }

  for (const entry of entries) {
    const fullEntryPath = path.join(currentDirPath, entry.name);
    // Relative path from the baseScanPath for ignore checks and final output path
    const relativeEntryPath = path.relative(baseScanPath, fullEntryPath);

    // Check if this specific entry (file or sub-directory) should be ignored.
    // This uses its relative path from baseScanPath.
    if (shouldIgnore(relativeEntryPath, entry.isDirectory(), config)) {
      // console.log(`Ignoring entry: ${relativeEntryPath} (isDir: ${entry.isDirectory()})`);
      continue;
    }

    if (entry.isDirectory()) {
      await scanDirectoryRecursive(fullEntryPath, baseScanPath, config, filesList);
    } else if (entry.isFile()) {
      filesList.push({
        path: relativeEntryPath.replace(/\\/g, '/'), // Standardize to forward slashes for output
        fullPath: fullEntryPath
      });
    }
  }
}

/**
 * Initiates scanning for project files.
 * @param {string} scanRootPath - The absolute path to start scanning from.
 * @param {object} config - The application configuration object.
 * @returns {Promise<Array<{path: string, fullPath: string}>>} A list of file objects.
 */
async function scanProjectFiles(scanRootPath, config) {
  const filesList = [];
  // baseScanPath is scanRootPath itself, as relative paths for ignore rules and output
  // are calculated from where the scan begins.
  await scanDirectoryRecursive(scanRootPath, scanRootPath, config, filesList);
  filesList.sort((a, b) => a.path.localeCompare(b.path));
  return filesList;
}

/**
 * Recursively searches for 'SYSTEM.txt' (case-sensitive).
 * It uses a simplified ignore logic: ignores directories by name if they are in config.ignore
 * and some hardcoded essential ignores like '.git', 'node_modules'.
 *
 * @param {string} currentDir - Absolute path of the directory currently being searched.
 * @param {string} baseScanPath - Absolute path of the initial directory where scanning for SYSTEM.txt started.
 * @param {object} config - The main application configuration, primarily for its 'ignore' list for directory names.
 * @param {Array<{fullPath: string, relativePath: string}>} foundSystemFilesList - Accumulator.
 * @returns {Promise<void>}
 */
async function findSystemTxtRecursive(currentDir, baseScanPath, config, foundSystemFilesList) {
    let entries;
    try {
        entries = await readdir(currentDir, { withFileTypes: true });
    } catch (err) {
        if (err.code === 'EPERM' || err.code === 'EACCES') {
            console.warn(`SYSTEM.txt search: Permission denied in ${currentDir}.`);
        }
        // else console.warn(`SYSTEM.txt search: Error reading ${currentDir}: ${err.message}`); // Can be noisy
        return;
    }

    for (const entry of entries) {
        const fullEntryPath = path.join(currentDir, entry.name);
        const relativeEntryPathFromBaseScan = path.relative(baseScanPath, fullEntryPath).replace(/\\/g, '/');

        if (entry.name === 'SYSTEM.txt' && entry.isFile()) {
            foundSystemFilesList.push({
                fullPath: fullEntryPath,
                relativePath: relativeEntryPathFromBaseScan
            });
        } else if (entry.isDirectory()) {
            let ignoreThisDir = false;
            const dirName = entry.name;

            // Check against config.ignore (directory names only for this specific search)
            if (config.ignore && Array.isArray(config.ignore)) {
                for (const ignorePattern of config.ignore) {
                    const normalizedIgnorePattern = ignorePattern.replace(/\\/g, '/').trim();
                    // For SYSTEM.txt search, we only check if the *name* of the directory matches.
                    // This is a simplified ignore compared to the main file scan.
                    if (dirName === normalizedIgnorePattern) {
                         ignoreThisDir = true;
                         break;
                    }
                }
            }
            
            // Hardcoded essential ignores for system search to prevent deep scanning in common large/irrelevant dirs
            if (['.git', 'node_modules', 'dist', 'build', 'out', 'target', '.next', '.nuxt', '.svelte-kit'].includes(dirName)) {
                ignoreThisDir = true;
            }

            if (!ignoreThisDir) {
                await findSystemTxtRecursive(fullEntryPath, baseScanPath, config, foundSystemFilesList);
            }
        }
    }
}

/**
 * Finds the most relevant 'SYSTEM.txt' file.
 * The most relevant is the one closest to the scan root, then by lexicographical order of relative path.
 * @param {string} scanRootPath - The absolute path to start searching for SYSTEM.txt.
 * @param {object} config - The application configuration.
 * @returns {Promise<{fullPath: string, relativePath: string} | null>} The found SYSTEM.txt file info or null.
 */
async function findSystemFile(scanRootPath, config) {
    const foundSystemFiles = [];
    await findSystemTxtRecursive(scanRootPath, scanRootPath, config, foundSystemFiles);

    if (foundSystemFiles.length === 0) {
        return null;
    }

    foundSystemFiles.sort((a, b) => {
        const depthA = a.relativePath.split('/').length;
        const depthB = b.relativePath.split('/').length;
        if (depthA !== depthB) return depthA - depthB; // shallowest first
        return a.relativePath.localeCompare(b.relativePath); // then lexicographically
    });

    console.log(`Found ${foundSystemFiles.length} SYSTEM.txt files. Selected: ${foundSystemFiles[0].relativePath}`);
    return foundSystemFiles[0];
}


module.exports = {
  scanProjectFiles,
  findSystemFile,
};