/**
 * Single source of truth for the mobile module registry.
 *
 * This file replaces the previous trio of `registry.js`, `registry.d.ts` and
 * `registry.ts`, which all resolved to the same module specifier and shadowed
 * each other (Metro prefers `.js` over `.ts`, so this file was dead code at
 * runtime). `registry.js` and `registry.d.ts` must be deleted.
 *
 * Import it extensionless: `import { getHomeModules } from '../core/modules/registry';`
 */

/* -------------------------------------------------------------------------- */
/* Module registry (home screen tiles)                                        */
/* -------------------------------------------------------------------------- */

export type ModuleStatus = 'active' | 'coming-soon' | 'disabled';

export interface AppModule {
  id: string;
  label: string;
  icon: string;
  status: ModuleStatus;
  route?: `/${string}`;
  visibleOnHome?: boolean;
}

const MODULE_ID_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;
const MODULE_STATUSES: readonly ModuleStatus[] = ['active', 'coming-soon', 'disabled'];

function validateModule(definition: AppModule): Readonly<AppModule> {
  if (!definition || typeof definition !== 'object') {
    throw new TypeError('Module definition must be an object');
  }
  if (!MODULE_ID_PATTERN.test(definition.id || '')) {
    throw new TypeError('Invalid module id');
  }
  if (typeof definition.label !== 'string' || !definition.label.trim()) {
    throw new TypeError(`Module ${definition.id} requires a label`);
  }
  if (typeof definition.icon !== 'string' || !definition.icon.trim()) {
    throw new TypeError(`Module ${definition.id} requires an icon`);
  }
  if (!MODULE_STATUSES.includes(definition.status)) {
    throw new TypeError(`Invalid status for module ${definition.id}`);
  }
  if (definition.status === 'active' && (typeof definition.route !== 'string' || !definition.route.startsWith('/'))) {
    throw new TypeError(`Active module ${definition.id} requires an absolute route`);
  }
  if (definition.route && !definition.route.startsWith('/')) {
    throw new TypeError(`Module ${definition.id} route must be absolute`);
  }
  return Object.freeze({ visibleOnHome: true, ...definition });
}

export function createModuleRegistry(definitions: AppModule[]): readonly Readonly<AppModule>[] {
  if (!Array.isArray(definitions)) throw new TypeError('Module definitions must be an array');
  const ids = new Set<string>();
  const routes = new Set<string>();
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

export const MODULE_REGISTRY: readonly Readonly<AppModule>[] = createModuleRegistry([
  { id: 'bill-payment', label: 'پرداخت قبض', icon: '💳', status: 'coming-soon' },
  { id: 'bill-calculator', label: 'استاندارد ها و دستورالعملها', icon: '🧾', status: 'coming-soon' },
  { id: 'engineering', label: 'آموزش و محاسبات فنی', icon: '⚡', status: 'coming-soon' },
  { id: 'safety', label: 'پیام‌ها و اصول ایمنی', icon: '🦺', status: 'coming-soon' },
  { id: 'project', label: 'استاندارد ها و دستورالعملها', icon: '📝', status: 'coming-soon' },
  { id: 'notebook', label: 'دفترچه فنی', icon: '📒', status: 'active', route: '/notebook' },
]);

export function getHomeModules(): readonly Readonly<AppModule>[] {
  return MODULE_REGISTRY.filter(module => module.visibleOnHome && module.status !== 'disabled');
}

export function getModuleById(id: string): Readonly<AppModule> | null {
  return MODULE_REGISTRY.find(module => module.id === id) ?? null;
}

/* -------------------------------------------------------------------------- */
/* Feature manifest registry                                                  */
/* -------------------------------------------------------------------------- */
/* Kept here so existing imports of `registerFeature` / `listFeatures` /       */
/* `isFeatureEnabled` from this module keep working. It can be split into its  */
/* own `features.ts` later without touching the module registry above.         */

export type FeatureManifest = {
  id: string;
  version: string;
  title: string;
  enabledByDefault: boolean;
  dependencies?: string[];
};

const featureRegistry = new Map<string, FeatureManifest>();

export function registerFeature(manifest: FeatureManifest): void {
  if (!/^[a-z][a-z0-9-]{1,63}$/.test(manifest.id)) throw new Error(`Invalid feature id: ${manifest.id}`);
  if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) throw new Error(`Invalid feature version: ${manifest.version}`);
  if (featureRegistry.has(manifest.id)) throw new Error(`Feature already registered: ${manifest.id}`);
  featureRegistry.set(manifest.id, Object.freeze({ ...manifest, dependencies: [...(manifest.dependencies ?? [])] }));
}

export function listFeatures(): FeatureManifest[] {
  return [...featureRegistry.values()].map(feature => ({ ...feature, dependencies: [...(feature.dependencies ?? [])] }));
}

export function isFeatureEnabled(id: string, flags: Record<string, boolean> = {}): boolean {
  const feature = featureRegistry.get(id);
  if (!feature) return false;
  return flags[id] ?? feature.enabledByDefault;
}
