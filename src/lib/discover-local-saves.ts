const savedPlanIds = new Set<string>();

export function isDiscoverPlanSavedLocally(planId: string): boolean {
  return savedPlanIds.has(planId);
}

export function toggleDiscoverPlanSavedLocally(planId: string): boolean {
  if (savedPlanIds.has(planId)) {
    savedPlanIds.delete(planId);
    return false;
  }
  savedPlanIds.add(planId);
  return true;
}

export function getLocalSavedDiscoverCount(): number {
  return savedPlanIds.size;
}
