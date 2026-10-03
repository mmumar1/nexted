export interface ModuleLike {
  id: string;
  order: number;
  parentModuleId?: string | null;
}

export function getModuleDisplayLabel(module: ModuleLike, allModules: ModuleLike[]) {
  if (!module.parentModuleId) {
    return `Module ${module.order}`;
  }

  const parent = allModules.find((item) => item.id === module.parentModuleId);
  if (!parent) {
    return `Module ${module.order}`;
  }

  return `Module ${parent.order}.${module.order}`;
}

export function compareModuleOrder(a: ModuleLike, b: ModuleLike, allModules: ModuleLike[]) {
  const parentA = a.parentModuleId ? allModules.find((item) => item.id === a.parentModuleId) : undefined;
  const parentB = b.parentModuleId ? allModules.find((item) => item.id === b.parentModuleId) : undefined;

  const aPath = parentA ? [parentA.order, 1, a.order] : [a.order, 0, 0];
  const bPath = parentB ? [parentB.order, 1, b.order] : [b.order, 0, 0];

  for (let index = 0; index < Math.max(aPath.length, bPath.length); index += 1) {
    const aValue = aPath[index] ?? 0;
    const bValue = bPath[index] ?? 0;
    if (aValue !== bValue) return aValue - bValue;
  }

  return 0;
}