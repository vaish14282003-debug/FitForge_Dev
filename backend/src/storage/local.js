const fs = require('fs/promises');
const path = require('path');

// Files under one directory on this machine. Keys never contain "..", so they can't escape it.
function createLocalStorage(baseDir) {
  const root = path.resolve(baseDir);
  const fullPath = (key) => {
    const resolved = path.resolve(root, key);
    if (!resolved.startsWith(root + path.sep)) throw new Error('Invalid storage key');
    return resolved;
  };

  return {
    driver: 'local',
    async put(key, body) {
      const file = fullPath(key);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, body);
    },
    async remove(key) {
      await fs.rm(fullPath(key), { force: true });
    },
    /** Resolves to the file path, or null if it doesn't exist. */
    async locate(key) {
      const file = fullPath(key);
      try {
        await fs.access(file);
        return file;
      } catch {
        return null;
      }
    },
  };
}

module.exports = { createLocalStorage };
