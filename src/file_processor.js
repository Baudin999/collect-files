// src/file_processor.js
const path = require('path');
const { readFile, existsSync } = require('./fs_utils'); // Using existsSync for quick check of metadata file

const COMMON_BINARY_EXTENSIONS = [
  '.exe', '.dll', '.so', '.dylib', '.o', '.a', '.lib', '.bundle', '.obj', '.pdb', '.class', '.pyc', '.pyo', '.beam',
  '.cmo', '.cmi', '.cmx', '.zip', '.tar', '.gz', '.rar', '.7z', '.jar', '.war', '.nupkg', '.pkg', '.dmg',
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.webp', '.ico', '.mp3', '.wav', '.ogg', '.mp4', '.mov',
  '.avi', '.pdf', '.woff', '.woff2', '.ttf', '.otf', '.eot', '.sqlite', '.db', '.dat'
];

const MAX_CONTENT_LENGTH = 200000; // Max characters for a file's content to avoid huge outputs

/**
 * Reads metadata from a corresponding .meta.txt file if it exists.
 * @param {string} mainFilePath - The full path to the main file (e.g., /path/to/code.js)
 * @param {string} metadataSuffix - The suffix for metadata files (e.g., .meta.txt)
 * @returns {Promise<string|null>} The metadata content or null if not found/error.
 */
async function readMetadataFile(mainFilePath, metadataSuffix) {
  const dirName = path.dirname(mainFilePath);
  const baseName = path.basename(mainFilePath);
  const metadataFilePath = path.join(dirName, baseName + metadataSuffix);

  if (existsSync(metadataFilePath)) {
    try {
      const metadataContent = await readFile(metadataFilePath, 'utf8');
      return metadataContent.trim();
    } catch (error) {
      console.warn(`Warning: Could not read metadata file ${metadataFilePath}: ${error.message}`);
      return null;
    }
  }
  return null;
}

/**
 * Processes a single file: reads its content, checks for metadata, and formats it for markdown.
 * 
 * @param {{path: string, fullPath: string}} fileInfo - Object containing file's relative and full path.
 * @param {object} config - The application configuration object.
 * @param {string} config.metadataSuffix - Suffix for metadata files.
 * @param {Array<object>} config.compressionRules - Compression rules (placeholder for now).
 * @returns {Promise<{path: string, markdown: string}>} Processed file info with markdown content.
 */
async function processFileContent(fileInfo, config) {
  const normalizedPath = fileInfo.path; // Already normalized to forward slashes by file_scanner
  let markdownContent = `## ${normalizedPath}\n\n`;
  let fileContent = '';
  let errorReadingFile = false;
  let isBinary = false;

  try {
    const fileExtension = path.extname(normalizedPath).toLowerCase();

    if (COMMON_BINARY_EXTENSIONS.includes(fileExtension)) {
      isBinary = true;
      markdownContent += `*Binary file (ext: ${fileExtension}) - content not included*\n\n`;
    } else {
      try {
        fileContent = await readFile(fileInfo.fullPath, 'utf8');
      } catch (readError) {
        errorReadingFile = true;
        markdownContent += `*Unable to read file as text (Error: ${readError.code}). Likely binary or unsupported encoding.*\n\n`;
      }

      if (!errorReadingFile) {
        // Handle metadata file
        const metadata = await readMetadataFile(fileInfo.fullPath, config.metadataSuffix);
        if (metadata) {
          markdownContent += `**Associated Metadata:**\n\`\`\`text\n${metadata}\n\`\`\`\n\n`;
        }

        // TODO: Implement compression strategies based on config.compressionRules
        // For now, just include full content (or truncated)
        // Example placeholder for compression:
        // const applicableRule = findApplicableCompressionRule(normalizedPath, config.compressionRules);
        // if (applicableRule) {
        //   fileContent = applyCompression(fileContent, fileExtension, applicableRule);
        // }


        // Sanitize backticks for markdown code blocks
        fileContent = fileContent.replace(/```/g, '\\`\\`\\`');

        if (fileContent.length > MAX_CONTENT_LENGTH) {
          fileContent = fileContent.substring(0, MAX_CONTENT_LENGTH) + `\n\n... [Content truncated due to length] ...`;
        }
        
        const lang = fileExtension.substring(1) || 'text'; // Get language for syntax highlighting
        markdownContent += `\`\`\`${lang}\n${fileContent}\n\`\`\`\n\n`;
      }
    }
  } catch (error) {
    console.error(`Error processing file ${normalizedPath}: ${error.message}`);
    markdownContent = `## ${normalizedPath}\n\n**Error during processing: ${error.message}**\n\n`;
  }

  return {
    path: normalizedPath,
    markdown: markdownContent,
  };
}

/**
 * Generates a markdown-friendly anchor link from a file path.
 * @param {string} filePath - The file path.
 * @returns {string} The anchor link.
 */
function pathToAnchor(filePath) {
  return filePath
    .toLowerCase()
    .replace(/\\/g, '/') // Ensure forward slashes
    .replace(/[^a-z0-9\/\-]/g, '-') // Replace non-alphanumeric (excluding / -) with -
    .replace(/\/+/g, '-') // Replace multiple slashes with a single dash
    .replace(/-+/g, '-') // Replace multiple dashes with a single dash
    .replace(/^-|-$/g, ''); // Trim leading/trailing dashes
}

module.exports = {
  processFileContent,
  pathToAnchor,
  readMetadataFile, // Exporting for potential direct use or testing
};