// src/ignore_handler.js
const path = require('path');

/**
 * Checks if an item (file or directory) should be ignored based on the configuration.
 * 
 * @param {string} relativeItemPath - The relative path of the item from the scan base.
 * @param {boolean} isDirectory - True if the item is a directory, false if it's a file.
 * @param {object} config - The application configuration object.
 * @param {string[]} config.ignore - List of names or relative paths to ignore.
 * @param {string[]} config.ignoreExtensions - List of file extensions to ignore.
 * @param {string[]} config.includeExtensions - List of file extensions to include (acts as whitelist).
 * @returns {boolean} True if the item should be ignored, false otherwise.
 */
function shouldIgnore(relativeItemPath, isDirectory, config) {
  const normalizedItemPath = relativeItemPath.replace(/\\/g, '/'); // e.g., "src/some/file.js" or "node_modules"
  const itemName = path.basename(normalizedItemPath); // e.g., "file.js" or "node_modules"

  // Dynamically add the output file to the ignore list if not already present
  // This check should ideally be done once when config is finalized,
  // but for safety, can be checked here or ensured by the caller.
  // For now, assuming config.ignore is already populated with the output file.

  // Check against config.ignore (names or full relative paths)
  for (const ignoreEntry of config.ignore) {
    const normalizedIgnoreEntry = ignoreEntry.replace(/\\/g, '/').trim();
    if (itemName === normalizedIgnoreEntry || normalizedItemPath === normalizedIgnoreEntry) {
      return true;
    }
  }

  if (isDirectory) {
    // For directories, only the name/path check in config.ignore applies.
    return false;
  } else {
    // For files:
    const fileExtension = path.extname(normalizedItemPath).substring(1).toLowerCase();

    // 1. Check ignoreExtensions
    if (config.ignoreExtensions && config.ignoreExtensions.includes(fileExtension)) {
      return true;
    }

    // 2. Apply includeExtensions logic (if non-empty, acts as a whitelist)
    // This must happen *after* specific name/path ignores and extension ignores.
    // If includeExtensions is restrictive, a file not matching it is "ignored".
    if (config.includeExtensions && config.includeExtensions.length > 0) {
      if (!config.includeExtensions.includes(fileExtension)) {
        return true; // Ignored because it's not in the include list
      }
    }
    
    // If we reach here, the file is not ignored by name, path, or extension rules,
    // and if includeExtensions is used, it passed that whitelist.
    return false;
  }
}

module.exports = {
  shouldIgnore,
};