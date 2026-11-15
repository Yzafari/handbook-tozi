export type ModuleStatus = 'active' | 'coming-soon' | 'disabled';
export interface AppModule {
  id: string;
  label: string;
  icon: string;
  status: ModuleStatus;
  route?: `/${string}`;
  visibleOnHome?: boolean;
}
export function createModuleRegistry(definitions: AppModule[]): readonly Readonly<AppModule>[];
export const MODULE_REGISTRY: readonly Readonly<AppModule>[];
export function getHomeModules(): readonly Readonly<AppModule>[];
export function getModuleById(id: string): Readonly<AppModule> | null;
