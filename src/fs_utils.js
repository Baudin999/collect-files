// src/fs_utils.js
const fs = require('fs');
const { promisify } = require('util');

// Promisify fs functions
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const exists = promisify(fs.exists); // fs.exists is deprecated, but promisify works. Better to use fs.promises.access or stat.
const access = promisify(fs.access); // For checking existence and permissions

// It's generally recommended to use fs.promises directly if Node version allows (v10+)
// For broader compatibility or consistency with existing code, promisify is fine.
// Example using fs.promises:
// const { readdir, stat, readFile, writeFile } = require('fs').promises;

module.exports = {
  readdir,
  stat,
  readFile,
  writeFile,
  exists, // Or handle existence checks via stat/access in consuming code
  access,
  // fs.existsSync is synchronous and can be used directly if needed for specific cases
  // but async versions are preferred for non-blocking operations.
  existsSync: fs.existsSync 
};