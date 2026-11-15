import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const modulesRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/modules');

test('all enabled module manifests are valid, unique and have resolvable dependencies', async () => {
  const entries = await readdir(modulesRoot, { withFileTypes: true });
  const manifests = [];
  for (const entry of entries.filter(item => item.isDirectory())) {
    const manifestPath = path.join(modulesRoot, entry.name, 'module.json');
    let manifest;
    try { manifest = JSON.parse(await readFile(manifestPath, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    if (manifest.enabled !== true) continue;
    assert.equal(manifest.name, entry.name);
    await access(path.join(modulesRoot, entry.name, 'index.js'));
    if (manifest.syncEntities?.length) {
      const adapterPath = path.join(modulesRoot, entry.name, 'sync-adapter.js');
      await access(adapterPath);
      const adapter = await import(pathToFileURL(adapterPath).href);
      for (const entityType of manifest.syncEntities) assert.equal(typeof adapter.default?.[entityType], 'function', `${entry.name} must validate ${entityType}`);
    }
    manifests.push(manifest);
  }
  const names = new Set(manifests.map(item => item.name));
  const paths = manifests.map(item => item.basePath);
  assert.equal(names.size, manifests.length);
  assert.equal(new Set(paths).size, paths.length);
  for (const manifest of manifests) {
    assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
    assert.ok(manifest.basePath.startsWith('/'));
    for (const dependency of manifest.dependencies || []) assert.ok(names.has(dependency), `${manifest.name} has missing dependency ${dependency}`);
  }
});
