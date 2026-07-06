const savedGemIds = new Set<string>();

export function isLocalGemSavedLocally(gemId: string): boolean {
  return savedGemIds.has(gemId);
}

export function toggleLocalGemSavedLocally(gemId: string): boolean {
  if (savedGemIds.has(gemId)) {
    savedGemIds.delete(gemId);
    return false;
  }
  savedGemIds.add(gemId);
  return true;
}

export function clearLocalGemSaves(): void {
  savedGemIds.clear();
}
