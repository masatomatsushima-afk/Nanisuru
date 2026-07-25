/**
 * Pure place-name normalization — no react-native / logging deps.
 * Shared by itinerary-quality, seoul seeds, and Node verify scripts.
 */

export function normalizePlaceName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\b(the|a|an|de|la|le|les|du|des)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
