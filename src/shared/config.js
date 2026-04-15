import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

export function createConfigStore(configDir) {
  const accountsPath = join(configDir, 'accounts.json');
  const terminalsPath = join(configDir, 'terminals.json');

  async function readJson(path) {
    try {
      const text = await readFile(path, 'utf8');
      return JSON.parse(text);
    } catch (err) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }
  }

  async function writeJson(path, data) {
    await mkdir(configDir, { recursive: true });
    const tmp = path + '.tmp';
    await writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
    await rename(tmp, path);
  }

  return {
    accountsPath,
    terminalsPath,
    readAccounts: () => readJson(accountsPath),
    writeAccounts: (data) => writeJson(accountsPath, data),
    readTerminals: () => readJson(terminalsPath),
    writeTerminals: (data) => writeJson(terminalsPath, data),
  };
}

// Default store using ./config/ relative to project root
const projectRoot = new URL('../../..', import.meta.url).pathname;
export const configStore = createConfigStore(join(projectRoot, 'config'));
