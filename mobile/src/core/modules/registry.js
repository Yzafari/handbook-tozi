function validateModule(definition) {
  if (!definition || typeof definition !== 'object') throw new TypeError('Module definition must be an object');
  if (!/^[a-z][a-z0-9-]{1,63}$/.test(definition.id || '')) throw new TypeError('Invalid module id');
  if (typeof definition.label !== 'string' || !definition.label.trim()) throw new TypeError(`Module ${definition.id} requires a label`);
  if (typeof definition.icon !== 'string' || !definition.icon.trim()) throw new TypeError(`Module ${definition.id} requires an icon`);
  if (!['active', 'coming-soon', 'disabled'].includes(definition.status)) throw new TypeError(`Invalid status for module ${definition.id}`);
  if (definition.status === 'active' && (typeof definition.route !== 'string' || !definition.route.startsWith('/'))) throw new TypeError(`Active module ${definition.id} requires an absolute route`);
  if (definition.route && !definition.route.startsWith('/')) throw new TypeError(`Module ${definition.id} route must be absolute`);
  return Object.freeze({ visibleOnHome: true, ...definition });
}

export function createModuleRegistry(definitions) {
  if (!Array.isArray(definitions)) throw new TypeError('Module definitions must be an array');
  const ids = new Set();
  const routes = new Set();
  const modules = definitions.map(validateModule);
  for (const module of modules) {
    if (ids.has(module.id)) throw new Error(`Duplicate module id: ${module.id}`);
    ids.add(module.id);
    if (module.route) {
      if (routes.has(module.route)) throw new Error(`Duplicate module route: ${module.route}`);
      routes.add(module.route);
    }
  }
  return Object.freeze(modules);
}

export const MODULE_REGISTRY = createModuleRegistry([
  { id: 'bill-payment', label: 'پرداخت قبض', icon: '💳', status: 'coming-soon' },
  { id: 'bill-calculator', label: 'محاسبه قبض', icon: '🧾', status: 'coming-soon' },
  { id: 'engineering', label: 'محاسبات فنی', icon: '⚡', status: 'coming-soon' },
  { id: 'safety', label: 'پیام‌ها و اصول ایمنی', icon: '🦺', status: 'coming-soon' },
  { id: 'forms', label: 'فرم‌ها و چک‌لیست‌ها', icon: '📝', status: 'coming-soon' },
  { id: 'notebook', label: 'دفترچه فنی', icon: '📒', status: 'active', route: '/notebook' },
]);

export function getHomeModules() { return MODULE_REGISTRY.filter(module => module.visibleOnHome && module.status !== 'disabled'); }
export function getModuleById(id) { return MODULE_REGISTRY.find(module => module.id === id) ?? null; }
