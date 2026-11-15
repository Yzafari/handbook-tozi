const entities = new Map();

export function registerSyncEntity({ moduleName, entityType, validatePayload }) {
  if (typeof moduleName !== 'string' || !/^[a-z][a-z0-9-]{1,63}$/.test(moduleName)) throw new TypeError('Invalid sync module name');
  if (typeof entityType !== 'string' || !/^[A-Z][A-Za-z0-9]{1,63}$/.test(entityType)) throw new TypeError('Invalid sync entity type');
  if (typeof validatePayload !== 'function') throw new TypeError(`Sync entity ${entityType} requires a payload validator`);
  const key = `${moduleName}:${entityType}`;
  if (entities.has(key)) throw new Error(`Sync entity already registered: ${key}`);
  entities.set(key, Object.freeze({ moduleName, entityType, validatePayload }));
}

export function getSyncEntity(moduleName, entityType) {
  return entities.get(`${moduleName}:${entityType}`) ?? null;
}

export function listSyncEntities() {
  return [...entities.values()].map(({ moduleName, entityType }) => ({ moduleName, entityType }));
}

export function clearSyncEntitiesForTests() { entities.clear(); }
