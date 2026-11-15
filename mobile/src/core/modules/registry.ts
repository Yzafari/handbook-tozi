export type FeatureManifest = {
  id: string;
  version: string;
  title: string;
  enabledByDefault: boolean;
  dependencies?: string[];
};

const registry = new Map<string, FeatureManifest>();

export function registerFeature(manifest: FeatureManifest): void {
  if (!/^[a-z][a-z0-9-]{1,63}$/.test(manifest.id)) throw new Error(`Invalid feature id: ${manifest.id}`);
  if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) throw new Error(`Invalid feature version: ${manifest.version}`);
  if (registry.has(manifest.id)) throw new Error(`Feature already registered: ${manifest.id}`);
  registry.set(manifest.id, Object.freeze({ ...manifest, dependencies: [...(manifest.dependencies ?? [])] }));
}

export function listFeatures(): FeatureManifest[] {
  return [...registry.values()].map(feature => ({ ...feature, dependencies: [...(feature.dependencies ?? [])] }));
}

export function isFeatureEnabled(id: string, flags: Record<string, boolean> = {}): boolean {
  const feature = registry.get(id);
  if (!feature) return false;
  return flags[id] ?? feature.enabledByDefault;
}
