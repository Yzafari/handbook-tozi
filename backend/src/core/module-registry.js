import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { registerSyncEntity, clearSyncEntitiesForTests } from './sync-entity-registry.js';

/**
 * Feature modules are discovered only through an explicit `enabled: true`
 * manifest. A module owns its routes and dependencies; the v1 router does not
 * need to be edited when a new, reviewed module is added.
 */
const modules = new Map();
let discoveryComplete = false;

function normalizeDefinition(definition) {
  if (!definition || typeof definition !== 'object') throw new TypeError('Module definition is required');
  const { name, version, router, dependencies = [], requires = [], syncEntities = [], basePath = `/modules/${name}` } = definition;
  if (typeof name !== 'string' || !/^[a-z][a-z0-9-]{1,63}$/.test(name)) throw new TypeError('Invalid module name');
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/.test(version)) throw new TypeError(`Invalid version for module ${name}`);
  if (!router || typeof router !== 'function') throw new TypeError(`Module ${name} must provide an Express router`);
  if (typeof basePath !== 'string' || !/^\/[a-z0-9][a-z0-9/-]*$/.test(basePath) || basePath.includes('//') || basePath.includes('..')) throw new TypeError(`Invalid basePath for module ${name}`);
  if (!Array.isArray(dependencies) || !dependencies.every(item => typeof item === 'string')) throw new TypeError(`Invalid dependencies for module ${name}`);
  if (!Array.isArray(requires) || !requires.every(item => typeof item === 'string')) throw new TypeError(`Invalid external requirements for module ${name}`);
  if (!Array.isArray(syncEntities) || !syncEntities.every(item => typeof item === 'string')) throw new TypeError(`Invalid syncEntities for module ${name}`);
  return Object.freeze({ name, version, router, basePath, dependencies: Object.freeze([...dependencies]), requires: Object.freeze([...requires]), syncEntities: Object.freeze([...syncEntities]) });
}

export function registerModule(definition) {
  const normalized = normalizeDefinition(definition);
  if (modules.has(normalized.name)) throw new Error(`Module already registered: ${normalized.name}`);
  if ([...modules.values()].some(item => item.basePath === normalized.basePath)) throw new Error(`Module basePath already registered: ${normalized.basePath}`);
  modules.set(normalized.name, normalized);
  return normalized;
}

function orderByDependencies(definitions) {
  const byName = new Map(definitions.map(item => [item.name, item]));
  const visiting = new Set();
  const visited = new Set();
  const ordered = [];
  function visit(item) {
    if (visited.has(item.name)) return;
    if (visiting.has(item.name)) throw new Error(`Circular module dependency detected at ${item.name}`);
    visiting.add(item.name);
    for (const dependency of item.dependencies) {
      const target = byName.get(dependency);
      if (!target) throw new Error(`Module ${item.name} depends on missing module ${dependency}`);
      visit(target);
    }
    visiting.delete(item.name);
    visited.add(item.name);
    ordered.push(item);
  }
  for (const item of definitions) visit(item);
  return ordered;
}

export async function discoverAndRegisterModules(directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../modules')) {
  if (discoveryComplete) return getRegisteredModules();
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const definitions = [];
  for (const entry of entries.filter(item => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const moduleDirectory = path.join(directory, entry.name);
    const manifestPath = path.join(moduleDirectory, 'module.json');
    let manifest;
    try { manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') continue; throw new Error(`Invalid module manifest at ${manifestPath}: ${error.message}`); }
    if (manifest.enabled !== true) continue;
    const entryPath = path.join(moduleDirectory, 'index.js');
    await fs.access(entryPath);
    const imported = await import(pathToFileURL(entryPath).href);
    let validators = {};
    const adapterPath = path.join(moduleDirectory, 'sync-adapter.js');
    try { await fs.access(adapterPath); const adapterModule = await import(pathToFileURL(adapterPath).href); validators = adapterModule.default ?? {}; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    definitions.push({ ...manifest, router: imported.default, syncValidators: validators });
  }
  const ordered = orderByDependencies(definitions);
  for (const definition of ordered) {
    const registered = registerModule(definition);
    for (const entityType of registered.syncEntities) {
      const validator = definition.syncValidators?.[entityType];
      if (typeof validator !== 'function') throw new Error(`Module ${registered.name} is missing a validator for sync entity ${entityType}`);
      registerSyncEntity({ moduleName: registered.name, entityType, validatePayload: validator });
    }
  }
  discoveryComplete = true;
  return getRegisteredModules();
}

export function getRegisteredModules() {
  return [...modules.values()].map(({ name, version, basePath, dependencies, requires, syncEntities }) => ({
    name, version, basePath, dependencies: [...dependencies], requires: [...requires], syncEntities: [...syncEntities],
  }));
}

export function mountRegisteredModules(router) {
  for (const module of modules.values()) router.use(module.basePath, module.router);
}

export function clearModuleRegistryForTests() { modules.clear(); discoveryComplete = false; clearSyncEntitiesForTests(); }
