import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { registerModule, getRegisteredModules, clearModuleRegistryForTests, discoverAndRegisterModules } from '../src/core/module-registry.js';
import { getSyncEntity } from '../src/core/sync-entity-registry.js';

 test('module registry registers metadata without exposing implementation objects', () => {
  clearModuleRegistryForTests();
  registerModule({ name: 'sample-module', version: '1.0.0', router: () => {}, dependencies: ['auth'] });
  assert.deepEqual(getRegisteredModules(), [{ name: 'sample-module', version: '1.0.0', basePath: '/modules/sample-module', dependencies: ['auth'], requires: [], syncEntities: [] }]);
  clearModuleRegistryForTests();
});

test('module registry rejects duplicate names and base paths', () => {
  clearModuleRegistryForTests();
  registerModule({ name: 'sample-module', version: '1.0.0', basePath: '/sample', router: () => {} });
  assert.throws(() => registerModule({ name: 'sample-module', version: '1.0.1', basePath: '/other', router: () => {} }), /already registered/);
  assert.throws(() => registerModule({ name: 'another-module', version: '1.0.0', basePath: '/sample', router: () => {} }), /basePath already registered/);
  clearModuleRegistryForTests();
});

test('module registry rejects invalid definitions', () => {
  clearModuleRegistryForTests();
  assert.throws(() => registerModule({ name: '../bad', version: '1.0.0', router: () => {} }), /Invalid module name/);
  assert.throws(() => registerModule({ name: 'bad-module', version: '1.0.0', basePath: '/../escape', router: () => {} }), /Invalid basePath/);
});

test('module discovery loads enabled manifests in dependency order and skips disabled modules', async () => {
  clearModuleRegistryForTests();
  const root = await mkdtemp(path.join(os.tmpdir(), 'handbook-modules-'));
  try {
    await mkdir(path.join(root, 'zeta-module'));
    await mkdir(path.join(root, 'alpha-module'));
    await mkdir(path.join(root, 'disabled-module'));
    await writeFile(path.join(root, 'zeta-module', 'module.json'), JSON.stringify({ enabled: true, name: 'zeta-module', version: '1.0.0', basePath: '/zeta', dependencies: ['alpha-module'], syncEntities: ['ZetaEntry'] }));
    await writeFile(path.join(root, 'zeta-module', 'index.js'), 'export default () => {};');
    await writeFile(path.join(root, 'zeta-module', 'sync-adapter.js'), 'export default { ZetaEntry: payload => typeof payload.value === \"string\" };');
    await writeFile(path.join(root, 'alpha-module', 'module.json'), JSON.stringify({ enabled: true, name: 'alpha-module', version: '1.0.0', basePath: '/alpha', dependencies: [] }));
    await writeFile(path.join(root, 'alpha-module', 'index.js'), 'export default () => {};');
    await writeFile(path.join(root, 'disabled-module', 'module.json'), JSON.stringify({ enabled: false, name: 'disabled-module', version: '1.0.0', basePath: '/disabled', dependencies: [] }));
    await writeFile(path.join(root, 'disabled-module', 'index.js'), 'throw new Error("disabled module must not be imported");');
    const registered = await discoverAndRegisterModules(root);
    assert.deepEqual(registered.map(item => item.name), ['alpha-module', 'zeta-module']);
    assert.equal(getSyncEntity('zeta-module', 'ZetaEntry').validatePayload({ value: 'ok' }), true);
  } finally {
    clearModuleRegistryForTests();
    await rm(root, { recursive: true, force: true });
  }
});

test('module discovery rejects missing dependencies and circular dependencies', async () => {
  clearModuleRegistryForTests();
  const missingRoot = await mkdtemp(path.join(os.tmpdir(), 'handbook-modules-missing-'));
  const cycleRoot = await mkdtemp(path.join(os.tmpdir(), 'handbook-modules-cycle-'));
  try {
    await mkdir(path.join(missingRoot, 'alpha-module'));
    await writeFile(path.join(missingRoot, 'alpha-module', 'module.json'), JSON.stringify({ enabled: true, name: 'alpha-module', version: '1.0.0', basePath: '/alpha', dependencies: ['missing-module'] }));
    await writeFile(path.join(missingRoot, 'alpha-module', 'index.js'), 'export default () => {};');
    await assert.rejects(discoverAndRegisterModules(missingRoot), /depends on missing module/);

    await mkdir(path.join(cycleRoot, 'alpha-module'));
    await mkdir(path.join(cycleRoot, 'beta-module'));
    await writeFile(path.join(cycleRoot, 'alpha-module', 'module.json'), JSON.stringify({ enabled: true, name: 'alpha-module', version: '1.0.0', basePath: '/alpha', dependencies: ['beta-module'] }));
    await writeFile(path.join(cycleRoot, 'alpha-module', 'index.js'), 'export default () => {};');
    await writeFile(path.join(cycleRoot, 'beta-module', 'module.json'), JSON.stringify({ enabled: true, name: 'beta-module', version: '1.0.0', basePath: '/beta', dependencies: ['alpha-module'] }));
    await writeFile(path.join(cycleRoot, 'beta-module', 'index.js'), 'export default () => {};');
    await assert.rejects(discoverAndRegisterModules(cycleRoot), /Circular module dependency/);
  } finally {
    clearModuleRegistryForTests();
    await rm(missingRoot, { recursive: true, force: true });
    await rm(cycleRoot, { recursive: true, force: true });
  }
});
